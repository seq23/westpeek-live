import { getDbClient } from "@/lib/d1/binding";
import type { DbClient } from "@/lib/d1/query";

/**
 * App-owned self-serve login (replaced the hosted auth service, 6 Oct 2026 — docs/SUPABASE_TO_CLOUDFLARE.md). Everything lives in D1:
 *
 *  - auth_users: email (lowercased, unique), PBKDF2-SHA256 hash, per-user 16-byte random salt and the
 *    iteration count used, so the count can be raised later and old rows still verify.
 *  - auth_sessions: the SHA-256 of a 32-byte random token. The raw token lives only in the
 *    HttpOnly cookie; a database read cannot be replayed as a login.
 *  - auth_password_resets: the SHA-256 of a 32-byte random token, expiring after an hour and
 *    consumed by ONE conditional UPDATE, so a link works once and only before it expires.
 *
 * Owner, operator, crew and special-guest access are not here: they are HMAC cookies (V5_*).
 */

/** Cloudflare Workers caps PBKDF2 at 100 000 iterations; this is that ceiling. */
export const PASSWORD_ITERATIONS = 100_000;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const RESET_TTL_SECONDS = 60 * 60;
export const MIN_PASSWORD_LENGTH = 10;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toHex(buffer);
}

export async function sha256Token(token: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export async function hashPassword(password: string, saltHex = randomToken(16), iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations }, key, 256);
  return { hash: toHex(new Uint8Array(bits)), salt: saltHex, iterations };
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: { hash: string; salt: string; iterations: number }) {
  const { hash } = await hashPassword(password, stored.salt, stored.iterations);
  return constantTimeEqual(hash, stored.hash);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function passwordProblem(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 512) return "That password is too long.";
  return undefined;
}

type Clock = () => number;
const systemClock: Clock = () => Date.now();

export interface AuthUserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  status: string;
}

export class PasswordAuth {
  constructor(private readonly client: DbClient = getDbClient(), private readonly now: Clock = systemClock) {}

  private iso(offsetSeconds = 0) {
    return new Date(this.now() + offsetSeconds * 1000).toISOString();
  }

  async findUserByEmail(email: string) {
    const { data, error } = await this.client.from("auth_users").select("*").eq("email", normalizeEmail(email)).maybeSingle();
    if (error) throw new Error(`auth_users read: ${error.message}`);
    return (data as AuthUserRow | null) ?? undefined;
  }

  /** Creates the login and the profile row the access resolver reads. A taken email is refused. */
  async signUp(input: { email: string; password: string; fullName?: string }): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
    const email = normalizeEmail(input.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, reason: "Enter a valid email address." };
    const problem = passwordProblem(input.password);
    if (problem) return { ok: false, reason: problem };
    if (await this.findUserByEmail(email)) return { ok: false, reason: "An account with that email already exists. Log in or reset the password." };
    const userId = crypto.randomUUID();
    const { hash, salt, iterations } = await hashPassword(input.password);
    const now = this.iso();
    const fullName = (input.fullName || "").trim() || email;
    const db = this.client.db;
    await db.batch([
      db.prepare('INSERT INTO "auth_users" ("id", "email", "full_name", "password_hash", "password_salt", "password_iterations", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(userId, email, fullName, hash, salt, iterations, now, now),
      db.prepare('INSERT INTO "profiles" ("id", "email", "full_name", "status", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?)').bind(userId, email, fullName, "active", now, now),
    ]);
    return { ok: true, userId };
  }

  /** The same answer for an unknown email and a wrong password, so the form cannot list accounts. */
  async signIn(email: string, password: string): Promise<{ ok: true; userId: string; token: string; expiresAt: string } | { ok: false }> {
    const user = await this.findUserByEmail(email);
    if (!user || user.status !== "active") {
      await hashPassword(password); // same work either way: no timing difference between the two refusals
      return { ok: false };
    }
    const valid = await verifyPassword(password, { hash: user.password_hash, salt: user.password_salt, iterations: Number(user.password_iterations) });
    if (!valid) return { ok: false };
    const session = await this.createSession(user.id);
    return { ok: true, userId: user.id, ...session };
  }

  async createSession(userId: string) {
    const token = randomToken();
    const expiresAt = this.iso(SESSION_TTL_SECONDS);
    const { error } = await this.client.from("auth_sessions").insert({ token_hash: await sha256Token(token), user_id: userId, created_at: this.iso(), expires_at: expiresAt });
    if (error) throw new Error(`auth_sessions insert: ${error.message}`);
    return { token, expiresAt };
  }

  /** The user id behind a live session token, or undefined for unknown, expired, revoked or disabled. */
  async resolveSession(token: string | undefined): Promise<string | undefined> {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return undefined;
    const { results } = await this.client.db
      .prepare('SELECT s."user_id" AS user_id FROM "auth_sessions" s JOIN "auth_users" u ON u."id" = s."user_id" WHERE s."token_hash" = ? AND s."revoked_at" IS NULL AND s."expires_at" > ? AND u."status" = ? LIMIT 1')
      .bind(await sha256Token(token), this.iso(), "active")
      .all<{ user_id: string }>();
    return results[0]?.user_id;
  }

  async revokeSession(token: string | undefined) {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
    await this.client.from("auth_sessions").update({ revoked_at: this.iso() }).eq("token_hash", await sha256Token(token));
  }

  /**
   * A reset token for a known, active account; undefined otherwise (the caller says the same thing
   * either way). Earlier unused tokens for the user are retired, so only the newest link works.
   */
  async createPasswordReset(email: string): Promise<{ token: string; userId: string; expiresAt: string } | undefined> {
    const user = await this.findUserByEmail(email);
    if (!user || user.status !== "active") return undefined;
    const token = randomToken();
    const expiresAt = this.iso(RESET_TTL_SECONDS);
    const now = this.iso();
    const db = this.client.db;
    await db.batch([
      db.prepare('UPDATE "auth_password_resets" SET "used_at" = ? WHERE "user_id" = ? AND "used_at" IS NULL').bind(now, user.id),
      db.prepare('INSERT INTO "auth_password_resets" ("token_hash", "user_id", "created_at", "expires_at") VALUES (?, ?, ?, ?)').bind(await sha256Token(token), user.id, now, expiresAt),
    ]);
    return { token, userId: user.id, expiresAt };
  }

  /**
   * Uses a reset token exactly once: ONE conditional UPDATE claims it (unused AND unexpired), so two
   * racing submissions cannot both succeed. The new password is set and every session of the user
   * is revoked — a reset after a stolen session ends that session.
   */
  async completePasswordReset(token: string, newPassword: string): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
    const problem = passwordProblem(newPassword);
    if (problem) return { ok: false, reason: problem };
    if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, reason: "That reset link is not valid." };
    const now = this.iso();
    const { results } = await this.client.db
      .prepare('UPDATE "auth_password_resets" SET "used_at" = ? WHERE "token_hash" = ? AND "used_at" IS NULL AND "expires_at" > ? RETURNING "user_id"')
      .bind(now, await sha256Token(token), now)
      .all<{ user_id: string }>();
    const userId = results[0]?.user_id;
    if (!userId) return { ok: false, reason: "That reset link has expired or was already used. Ask for a new one." };
    const { hash, salt, iterations } = await hashPassword(newPassword);
    const db = this.client.db;
    await db.batch([
      db.prepare('UPDATE "auth_users" SET "password_hash" = ?, "password_salt" = ?, "password_iterations" = ?, "updated_at" = ? WHERE "id" = ?').bind(hash, salt, iterations, now, userId),
      db.prepare('UPDATE "auth_sessions" SET "revoked_at" = ? WHERE "user_id" = ? AND "revoked_at" IS NULL').bind(now, userId),
    ]);
    return { ok: true, userId };
  }
}
