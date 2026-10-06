import { getD1 } from "@/lib/d1/binding";
import { createDbClient, type D1DatabaseLike } from "@/lib/d1/query";
import { PasswordAuth } from "./passwordAuth";

/**
 * The self-serve session cookie holds base64url JSON `{ accessToken, expiresAt }`. Decoded without
 * Buffer so it runs in the middleware runtime too.
 */
export function readSessionToken(cookieValue: string | undefined): string | undefined {
  if (!cookieValue) return undefined;
  try {
    const base64 = cookieValue.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64 + "===".slice((base64.length + 3) % 4)), (c) => c.charCodeAt(0)));
    const payload = JSON.parse(json) as { accessToken?: unknown };
    return typeof payload.accessToken === "string" && payload.accessToken ? payload.accessToken : undefined;
  } catch {
    return undefined;
  }
}

function localGauntletAllowed(token: string) {
  return token === "local-playwright-gauntlet-session" && (process.env.LOCAL_PLAYWRIGHT_GAUNTLET_AUTH === "true" || process.env.PLAYWRIGHT_LOCAL_E2E === "1");
}

/**
 * True only when the cookie's token matches a live, unrevoked, unexpired session of an active user
 * in D1. The presence of a cookie proves nothing: before 6 Oct 2026 the middleware let /app and
 * /admin through on ANY value in this cookie.
 */
export async function isValidSelfServeSession(cookieValue: string | undefined, db: D1DatabaseLike | undefined = getD1()): Promise<boolean> {
  const token = readSessionToken(cookieValue);
  if (!token) return false;
  if (localGauntletAllowed(token)) return true;
  if (!db) return false;
  const userId = await new PasswordAuth(createDbClient(db)).resolveSession(token).catch(() => undefined);
  return Boolean(userId);
}
