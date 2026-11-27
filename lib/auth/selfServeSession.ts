import { getD1 } from "@/lib/d1/binding";
import { createDbClient, type D1DatabaseLike } from "@/lib/d1/query";
import { PasswordAuth } from "./passwordAuth";
import { resolvePermissionUserForUserId } from "./authService";
import { isWorkspaceMember } from "./workspaceMembership";

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
 * What a self-serve session cookie is worth at the /app and /admin door.
 *
 *  - "member": a live, unrevoked, unexpired session of an active person who is an ACTIVE agency
 *    member (lib/auth/workspaceMembership.ts). Only this opens the workspace.
 *  - "no_workspace": a real session, but no membership: an account made at /signup that no agency
 *    has added. It is sent to the "ask to be added" page, never into /app.
 *  - "none": no cookie, a token that matches no live session, or a read that failed. A failed read is
 *    never a pass.
 *
 * The presence of a cookie proves nothing: before 6 Oct 2026 the middleware let /app and /admin
 * through on ANY value in this cookie, and until 27 Nov 2026 on any live session at all.
 */
export type SelfServeStanding = "member" | "no_workspace" | "none";

export async function selfServeStanding(cookieValue: string | undefined, db: D1DatabaseLike | undefined = getD1()): Promise<SelfServeStanding> {
  const token = readSessionToken(cookieValue);
  if (!token) return "none";
  if (localGauntletAllowed(token)) return "member";
  if (!db) return "none";
  const client = createDbClient(db);
  const userId = await new PasswordAuth(client).resolveSession(token).catch(() => undefined);
  if (!userId) return "none";
  const user = await resolvePermissionUserForUserId(userId, client).catch(() => undefined);
  if (user === undefined) return "none";
  return isWorkspaceMember(user) ? "member" : "no_workspace";
}
