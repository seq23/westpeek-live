import { cookies } from "next/headers";
import { readV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { crewDeniedReason, roleAllows, type CrewAction } from "@/lib/auth/crewRolePermissions";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { V4CrewRole } from "@/types/v4";
import { AccessStateUnavailableError, ACCESS_UNAVAILABLE_MESSAGE, crewCookieCurrent, getHostLinkState } from "@/services/events/hostLinkService";

export const REVOKED_HOST_LINK_ERROR = "Your crew link for this event was revoked. Ask the host or the owner for a new link.";

export type LiveControlAuthorization =
  | { ok: true; actorRole: "owner" | "operator" | "crew"; crewRole?: V4CrewRole; payload: V5AccessCookiePayload }
  | { ok: false; error: string; status?: 503 };

/**
 * Pure decision: which of the three cookies opens live control of this event, and — when the
 * caller names an action — whether the crew role on the cookie may perform it. Owner and operator
 * bypass the role table; a crew cookie is refused with the same sentence the deck shows on the
 * disabled control, so the UI and the server never disagree.
 */
export function authorizeLiveControl(input: { owner?: V5AccessCookiePayload; operator?: V5AccessCookiePayload; crew?: V5AccessCookiePayload }, eventId?: string, action?: CrewAction, currentCodeVersion = 0): LiveControlAuthorization {
  const { owner, operator, crew } = input;
  if (owner?.kind === "owner") return { ok: true, actorRole: "owner", payload: owner };
  if (operator?.kind === "operator" && (!operator.eventId || !eventId || operator.eventId === eventId)) return { ok: true, actorRole: "operator", payload: operator };
  if (crew?.kind === "crew" && (!crew.eventId || !eventId || crew.eventId === eventId)) {
    if (!crewCookieCurrent(crew.codeVersion, currentCodeVersion)) return { ok: false, error: REVOKED_HOST_LINK_ERROR };
    const crewRole = (crew.role || "crew") as V4CrewRole;
    if (action && !roleAllows(crewRole, action)) return { ok: false, error: crewDeniedReason(crewRole, action) };
    return { ok: true, actorRole: "crew", crewRole, payload: crew };
  }
  return { ok: false, error: "Owner, showrunner/operator, or crew access required." };
}

export async function requireLiveEventControlAccessForRequest(eventId?: string, action?: CrewAction): Promise<LiveControlAuthorization> {
  const env = getEnv();
  const names = getV5AccessCookieNames(env);
  const secret = getV5AccessCookieSecret(env);
  const cookieStore = await cookies();
  const [operator, owner, crew] = await Promise.all([
    readV5AccessCookie(cookieStore.get(names.operatorCookieName)?.value, secret),
    readV5AccessCookie(cookieStore.get(names.ownerCookieName)?.value, secret),
    readV5AccessCookie(cookieStore.get(names.crewCookieName)?.value, secret),
  ]);
  // Owner and operator are decided first: they need no read, so they keep working in an outage.
  // Only then is a crew cookie minted with the event's crew code checked against the current code
  // version (host-link revocation). An operator cookie for ANOTHER event is refused above and changes
  // nothing here: the crew cookie beside it is checked like any other.
  const privileged = authorizeLiveControl({ owner, operator }, eventId, action);
  if (privileged.ok) return privileged;
  let codeVersion = 0;
  if (crew?.kind === "crew" && crew.codeVersion !== undefined && eventId) {
    try {
      codeVersion = (await getHostLinkState(eventId)).codeVersion;
    } catch (error) {
      if (!(error instanceof AccessStateUnavailableError)) throw error;
      // Fail closed: an unknown version never lets a possibly revoked cookie through.
      return { ok: false, error: ACCESS_UNAVAILABLE_MESSAGE, status: 503 };
    }
  }
  return authorizeLiveControl({ crew }, eventId, action, codeVersion);
}
