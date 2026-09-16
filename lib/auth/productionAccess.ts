import type { V4CrewRole, V4SpecialGuestRole } from "@/types/v4";

export const V5_CREW_COOKIE_DEFAULT = "wpl_crew_access";
export const V5_SPECIAL_GUEST_COOKIE_DEFAULT = "wpl_guest_access";
export const V5_OPERATOR_COOKIE_DEFAULT = "wpl_operator_access";
export const V5_OWNER_COOKIE_DEFAULT = "wpl_owner_access";
export const V4_CREW_COOKIE_DEFAULT = V5_CREW_COOKIE_DEFAULT;
export const V4_SPECIAL_GUEST_COOKIE_DEFAULT = V5_SPECIAL_GUEST_COOKIE_DEFAULT;

interface V5AccessCookieBase {
  issuedAt: number;
  expiresAt: number;
}

export type V5AccessCookiePayload =
  /** `codeVersion`: set when the crew entered with the EVENT's crew code (a host link); revoking host links rotates the code and bumps the version, and a cookie behind it is refused. */
  | (V5AccessCookieBase & { kind: "crew"; eventId?: string; role?: V4CrewRole; codeVersion?: number })
  | (V5AccessCookieBase & { kind: "operator"; eventId?: string; role?: V4CrewRole })
  | (V5AccessCookieBase & { kind: "owner"; role?: "owner"; ownerKey?: "primary" | "secondary" })
  | (V5AccessCookieBase & { kind: "special_guest"; eventId: string; role: V4SpecialGuestRole; clientSlug?: string });

export type V4AccessCookiePayload = V5AccessCookiePayload;

function getTextEncoder() {
  return new TextEncoder();
}

function base64UrlEncode(bytes: Uint8Array | string) {
  const raw = typeof bytes === "string" ? bytes : Array.from(bytes).map((byte) => String.fromCharCode(byte)).join("");
  const base64 = typeof btoa !== "undefined" ? btoa(raw) : Buffer.from(raw, "binary").toString("base64");
  return base64.replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  if (typeof atob !== "undefined") return atob(padded);
  return Buffer.from(padded, "base64").toString("binary");
}

async function hmacSha256(body: string, secret: string) {
  const encoder = getTextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(body));
  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function assertUsableSecret(secret: string) {
  if (!secret || secret.length < 32) throw new Error("V5 access cookie secret must be at least 32 characters.");
}

export async function createV5AccessCookie(payload: V5AccessCookiePayload, secret: string) {
  assertUsableSecret(secret);
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(body, secret);
  return `v5.${body}.${signature}`;
}

export async function readV5AccessCookie(value: string | undefined, secret: string): Promise<V5AccessCookiePayload | undefined> {
  assertUsableSecret(secret);
  if (!value?.startsWith("v5.")) return undefined;
  const [, body, signature] = value.split(".");
  if (!body || !signature) return undefined;
  const expected = await hmacSha256(body, secret);
  if (!constantTimeEqual(expected, signature)) return undefined;
  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as V5AccessCookiePayload;
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) return undefined;
    if (parsed.kind === "special_guest" && (!parsed.role || !parsed.eventId)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export const createV4AccessCookie = createV5AccessCookie;
export const readV4AccessCookie = readV5AccessCookie;

export function getV5CookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const getV4CookieOptions = getV5CookieOptions;
