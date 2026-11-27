import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createDbClient } from "@/lib/d1/query";
import { setD1ForTests } from "@/lib/d1/binding";
import { hashPassword, PasswordAuth, PASSWORD_ITERATIONS, RESET_TTL_SECONDS, RESET_WINDOW_SECONDS, RESETS_PER_ACCOUNT_PER_HOUR, SESSION_TTL_SECONDS, sha256Token, verifyPassword } from "@/lib/auth/passwordAuth";
import { selfServeStanding } from "@/lib/auth/selfServeSession";
import { createTestD1 } from "./helpers/d1";

/**
 * App-owned self-serve login on a real D1 (replaced Supabase Auth, 6 Oct 2026): PBKDF2 hashing,
 * session expiry and revocation, single-use expiring reset tokens, and the middleware's /app gate
 * validating the session instead of trusting the presence of a cookie.
 */
let env: Awaited<ReturnType<typeof createTestD1>>;
// Anchored to the real clock: the /app gate (isValidSelfServeSession) builds its own PasswordAuth on
// the real clock, so a session issued at a fixed past date expired once that date was a week old
// (the gate test went red on its own around 13 Oct 2026). Every offset below stays relative.
let now = Date.now();
const clock = () => now;
let auth: PasswordAuth;

function cookieFor(token: string) {
  return Buffer.from(JSON.stringify({ accessToken: token }), "utf8").toString("base64url");
}

beforeAll(async () => {
  env = await createTestD1();
  auth = new PasswordAuth(createDbClient(env.db), clock);
}, 60_000);

afterAll(async () => {
  setD1ForTests(undefined);
  await env?.dispose();
});

describe("password hashing", () => {
  it("is PBKDF2-SHA256 at the Workers ceiling with a per-user salt, and verifies only the right password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(PASSWORD_ITERATIONS).toBe(100_000);
    expect(a.iterations).toBe(100_000);
    expect(a.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
  });
});

describe("sign-up, sign-in and sessions", () => {
  it("creates the login and its profile, refuses a duplicate, a short password and a bad email", async () => {
    const created = await auth.signUp({ email: " Test.Signup@WestPeek.Ventures ", password: "a-long-password-1", fullName: "Test Signup" });
    expect(created.ok).toBe(true);
    const row = await auth.findUserByEmail("test.signup@westpeek.ventures");
    expect(row).toMatchObject({ email: "test.signup@westpeek.ventures", password_iterations: 100_000 });
    expect(row?.password_hash).not.toContain("a-long-password-1");
    const profile = await createDbClient(env.db).from("profiles").select("*").eq("email", "test.signup@westpeek.ventures").maybeSingle();
    expect(profile.data).toMatchObject({ status: "active", full_name: "Test Signup" });
    expect(await auth.signUp({ email: "test.signup@westpeek.ventures", password: "another-long-pass" })).toMatchObject({ ok: false });
    expect(await auth.signUp({ email: "short@westpeek.ventures", password: "short" })).toMatchObject({ ok: false, reason: expect.stringMatching(/10 characters/) });
    expect(await auth.signUp({ email: "not-an-email", password: "a-long-password-1" })).toMatchObject({ ok: false });
  });

  it("signs in with the right password only, and stores the session token hashed", async () => {
    expect(await auth.signIn("test.signup@westpeek.ventures", "wrong-password-xx")).toEqual({ ok: false });
    expect(await auth.signIn("nobody@westpeek.ventures", "a-long-password-1")).toEqual({ ok: false });
    const ok = await auth.signIn("TEST.SIGNUP@westpeek.ventures", "a-long-password-1");
    if (!ok.ok) throw new Error("sign-in failed");
    expect(ok.token).toMatch(/^[0-9a-f]{64}$/);
    const stored = await env.db.prepare('SELECT "token_hash" FROM "auth_sessions"').all<{ token_hash: string }>();
    expect(stored.results.map((r) => r.token_hash)).toContain(await sha256Token(ok.token));
    expect(stored.results.map((r) => r.token_hash)).not.toContain(ok.token);
    expect(await auth.resolveSession(ok.token)).toBe(ok.userId);
  });

  it("expires a session after its TTL and honours revocation", async () => {
    const userId = (await auth.findUserByEmail("test.signup@westpeek.ventures"))!.id;
    const session = await auth.createSession(userId);
    expect(await auth.resolveSession(session.token)).toBe(userId);
    const saved = now;
    now += (SESSION_TTL_SECONDS + 1) * 1000;
    expect(await auth.resolveSession(session.token)).toBeUndefined();
    now = saved;
    await auth.revokeSession(session.token);
    expect(await auth.resolveSession(session.token)).toBeUndefined();
    expect(await auth.resolveSession("not-a-token")).toBeUndefined();
    expect(await auth.resolveSession("f".repeat(64))).toBeUndefined();
  });
});

describe("a signed-up account resolves to a user", () => {
  it("resolves the permission user from D1 without throwing (every access table read uses real columns)", async () => {
    setD1ForTests(env.db);
    try {
      const { resolvePermissionUserForUserId } = await import("@/lib/auth/authService");
      const userId = (await auth.findUserByEmail("test.signup@westpeek.ventures"))!.id;
      const user = await resolvePermissionUserForUserId(userId);
      expect(user).toMatchObject({ id: userId, email: "test.signup@westpeek.ventures" });
    } finally {
      setD1ForTests(undefined);
    }
  });
});

describe("password reset", () => {
  it("issues a reset only for a real account, uses it once, expires it, and ends old sessions", async () => {
    expect(await auth.createPasswordReset("nobody@westpeek.ventures")).toBeUndefined();
    const before = await auth.signIn("test.signup@westpeek.ventures", "a-long-password-1");
    if (!before.ok) throw new Error("sign-in failed");

    const reset = await auth.createPasswordReset("test.signup@westpeek.ventures");
    if (!reset) throw new Error("no reset");
    expect(reset.token).toMatch(/^[0-9a-f]{64}$/);
    expect(await auth.completePasswordReset(reset.token, "short")).toMatchObject({ ok: false });
    expect(await auth.completePasswordReset(reset.token, "a-new-long-password")).toMatchObject({ ok: true });
    // Single use: the same link a second time is refused.
    expect(await auth.completePasswordReset(reset.token, "yet-another-password")).toMatchObject({ ok: false, reason: expect.stringMatching(/expired or was already used/) });
    // The old password stops working, the new one works, and the session from before the reset is gone.
    expect(await auth.signIn("test.signup@westpeek.ventures", "a-long-password-1")).toEqual({ ok: false });
    expect((await auth.signIn("test.signup@westpeek.ventures", "a-new-long-password")).ok).toBe(true);
    expect(await auth.resolveSession(before.token)).toBeUndefined();

    // Expiry: a link older than the TTL is refused even unused.
    const late = await auth.createPasswordReset("test.signup@westpeek.ventures");
    if (!late) throw new Error("no reset");
    const saved = now;
    now += (RESET_TTL_SECONDS + 1) * 1000;
    expect(await auth.completePasswordReset(late.token, "after-expiry-password")).toMatchObject({ ok: false });
    now = saved;
    // An hour on, so the account's hourly reset count (3) starts again for the next two links.
    now += (RESET_WINDOW_SECONDS + 1) * 1000;
    // Only the newest link works: issuing another retires the previous one.
    const first = await auth.createPasswordReset("test.signup@westpeek.ventures");
    const second = await auth.createPasswordReset("test.signup@westpeek.ventures");
    expect(await auth.completePasswordReset(first!.token, "first-link-password")).toMatchObject({ ok: false });
    expect(await auth.completePasswordReset(second!.token, "second-link-password")).toMatchObject({ ok: true });
  });

  it("makes at most 3 links an account an hour: the 4th ask sends nothing and leaves the 3rd link working; an hour on it issues again", async () => {
    expect((await auth.signUp({ email: "reset.cap@westpeek.ventures", password: "a-long-password-2", fullName: "Reset Cap" })).ok).toBe(true);
    const links = [];
    for (let ask = 1; ask <= RESETS_PER_ACCOUNT_PER_HOUR; ask += 1) {
      const link = await auth.createPasswordReset("reset.cap@westpeek.ventures");
      expect(link, `ask ${ask}`).toBeDefined();
      links.push(link!);
      now += 60_000; // a minute apart, well inside the hour
    }
    expect(await auth.createPasswordReset("reset.cap@westpeek.ventures")).toBeUndefined();
    expect(await auth.createPasswordReset("RESET.CAP@westpeek.ventures")).toBeUndefined();
    // The refused ask did not retire the newest link the owner may be about to click.
    expect(await auth.completePasswordReset(links[links.length - 1].token, "a-capped-new-password")).toMatchObject({ ok: true });
    // The window slides: an hour after the first link, the account can ask again.
    now += RESET_WINDOW_SECONDS * 1000;
    expect(await auth.createPasswordReset("reset.cap@westpeek.ventures")).toBeDefined();
  });
});

describe("the /app and /admin gate validates the session", () => {
  it("refuses a forged, garbage or revoked cookie; a live session with no agency membership is not a workspace", async () => {
    const live = await auth.signIn("test.signup@westpeek.ventures", "second-link-password");
    if (!live.ok) throw new Error("sign-in failed");
    expect(await selfServeStanding(cookieFor(live.token), env.db)).toBe("no_workspace");
    expect(await selfServeStanding(undefined, env.db)).toBe("none");
    expect(await selfServeStanding("anything", env.db)).toBe("none");
    expect(await selfServeStanding(cookieFor("a".repeat(64)), env.db)).toBe("none");
    expect(await selfServeStanding(cookieFor(live.token), undefined)).toBe("none");
    await auth.revokeSession(live.token);
    expect(await selfServeStanding(cookieFor(live.token), env.db)).toBe("none");
  });

  it("middleware redirects /app with a cookie that is merely present, and sends a live non-member session to the invite page", async () => {
    setD1ForTests(env.db);
    const { middleware } = await import("@/middleware");
    const forged = new NextRequest("https://westpeek.live/app/events", { headers: { cookie: `agency_event_os_session=${cookieFor("b".repeat(64))}` } });
    const refused = await middleware(forged);
    expect(refused.status).toBe(307);
    expect(refused.headers.get("location")).toContain("next=%2Fapp%2Fevents");

    const live = await new PasswordAuth(createDbClient(env.db)).signIn("test.signup@westpeek.ventures", "second-link-password");
    if (!live.ok) throw new Error("sign-in failed");
    const notMember = await middleware(new NextRequest("https://westpeek.live/admin", { headers: { cookie: `agency_event_os_session=${cookieFor(live.token)}` } }));
    expect(notMember.headers.get("x-middleware-next")).toBeNull();
    expect(new URL(notMember.headers.get("location")!).pathname).toBe("/no-workspace");
    // The member half is tests/unit/workspaceMembership.test.ts.
    setD1ForTests(undefined);
  });

  it("no source file still lets /app through on the presence of the auth cookie", () => {
    const middlewareSource = fs.readFileSync("middleware.ts", "utf8");
    expect(middlewareSource).toContain("selfServeStanding(sessionCookie)");
    expect(middlewareSource).not.toMatch(/if \(sessionCookie && \(pathname/);
  });
});
