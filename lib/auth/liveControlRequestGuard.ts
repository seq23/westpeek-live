import { cookies } from "next/headers";
import { readV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { crewDeniedReason, roleAllows, type CrewAction } from "@/lib/auth/crewRolePermissions";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { V4CrewRole } from "@/types/v4";
import { crewCookieCurrent, getHostLinkState, HostLinkStateUnavailableError } from "@/services/events/hostLinkService";
import { effectiveCrewRole } from "@/lib/auth/crewRolePermissions";

export const REVOKED_HOST_LINK_ERROR = "Your crew link for this event was revoked. Ask the host or the owner for a new link.";

export const HOST_LINK_STATE_UNAVAILABLE_ERROR = "Crew access can't be checked right now. Try again in a minute.";

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
    const crewRole = effectiveCrewRole(crew);
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
  // A crew cookie minted with the event's crew code is checked against the current code version (host-link revocation).
  let codeVersion = 0;
  if (crew?.kind === "crew" && crew.codeVersion !== undefined && eventId && owner?.kind !== "owner" && operator?.kind !== "operator") {
    try {
      codeVersion = (await getHostLinkState(eventId)).codeVersion;
    } catch (error) {
      if (!(error instanceof HostLinkStateUnavailableError)) throw error;
      // Fail closed: an unknown version never lets a possibly revoked cookie through.
      console.error("[live-control] refusing crew cookie:", error.message);
      return { ok: false, error: HOST_LINK_STATE_UNAVAILABLE_ERROR, status: 503 };
    }
  }
  return authorizeLiveControl({ owner, operator, crew }, eventId, action, codeVersion);
}
