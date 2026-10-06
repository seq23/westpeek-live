import type { PermissionUser } from "@/types/permissions";
import { getD1 } from "@/lib/d1/binding";
import { createDbClient } from "@/lib/d1/query";
import { getAuthCookiePayload } from "./sessionCookie";
import { resolvePermissionUserForUserId } from "./authService";
import { PasswordAuth } from "./passwordAuth";

function getLocalPlaywrightGauntletUser(sessionAccessToken?: string): PermissionUser | null {
  if (process.env.LOCAL_PLAYWRIGHT_GAUNTLET_AUTH !== "true" && process.env.PLAYWRIGHT_LOCAL_E2E !== "1") return null;
  if (sessionAccessToken !== "local-playwright-gauntlet-session") return null;

  return {
    id: "local-playwright-gauntlet-agency-user",
    name: "Local Playwright Producer",
    email: "local-playwright@westpeek.live",
    roles: ["agency_owner", "executive_producer", "producer"],
    agencyIds: ["00000000-0000-0000-0000-000000000001"],
    clientIds: ["00000000-0000-0000-0000-000000000101"],
    eventIds: ["demo", "event-summit"],
  };
}

/** The self-serve user behind the session cookie: the token must match a live row in auth_sessions. */
export async function getCurrentUser(): Promise<PermissionUser | null> {
  const session = await getAuthCookiePayload();
  const localGauntletUser = getLocalPlaywrightGauntletUser(session?.accessToken);
  if (localGauntletUser) return localGauntletUser;
  if (!session?.accessToken) return null;

  const db = getD1();
  if (!db) return null;
  const userId = await new PasswordAuth(createDbClient(db)).resolveSession(session.accessToken).catch(() => undefined);
  if (!userId) return null;
  return resolvePermissionUserForUserId(userId);
}
