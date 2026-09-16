import { cookies } from "next/headers";
import { readV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { crewActionPermissions, crewDeniedReason, crewRoleDescriptions, crewRoleLabels, type CrewAction } from "@/lib/auth/crewRolePermissions";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { V4CrewRole } from "@/types/v4";
import { crewCookieCurrent, getHostLinkState } from "@/services/events/hostLinkService";

/**
 * Who is looking at a crew surface, as plain data the deck and the role badge can render:
 * the cookie kind, the crew role (for a crew cookie), a label, the one-line description, and
 * the actions the role may take. Owner and operator may do everything. "none" is an anonymous
 * request (the middleware normally never lets one reach a crew page).
 */
export interface CrewViewer {
  kind: "owner" | "operator" | "crew" | "none";
  role?: V4CrewRole;
  label: string;
  description: string;
  allowed: "all" | readonly CrewAction[];
  eventId?: string;
  /** True for the host of this event: an executive_producer crew cookie scoped to it, or any owner/operator cookie. */
  isHost: boolean;
}

function eventMatches(cookieEventId: string | undefined, eventId: string | undefined) {
  if (!cookieEventId || !eventId) return true;
  if (cookieEventId === eventId) return true;
  return (cookieEventId === "demo" && eventId === "event-summit") || (cookieEventId === "event-summit" && eventId === "demo");
}

export function crewViewerFromPayloads(input: { owner?: V5AccessCookiePayload; operator?: V5AccessCookiePayload; crew?: V5AccessCookiePayload }, eventId?: string, currentCodeVersion = 0): CrewViewer {
  const { owner, operator, crew } = input;
  if (owner?.kind === "owner") return { kind: "owner", label: "Owner", description: "The master password. Every control on every event, and every guest's view.", allowed: "all", isHost: true };
  if (operator?.kind === "operator" && eventMatches(operator.eventId, eventId)) return { kind: "operator", label: "Operator", description: "West Peek's control room. Every control on this event.", allowed: "all", eventId: operator.eventId, isHost: true };
  if (crew?.kind === "crew" && eventMatches(crew.eventId, eventId)) {
    if (!crewCookieCurrent(crew.codeVersion, currentCodeVersion)) return { kind: "none", label: "Crew link revoked", description: "Your crew link for this event was revoked. Ask the host or the owner for a new link.", allowed: [], isHost: false };
    const role = (crew.role || "crew") as V4CrewRole;
    return { kind: "crew", role, label: crewRoleLabels[role] || "Crew", description: crewRoleDescriptions[role] || crewRoleDescriptions.crew, allowed: crewActionPermissions[role] || crewActionPermissions.crew, eventId: crew.eventId, isHost: role === "executive_producer" };
  }
  return { kind: "none", label: "Not signed in", description: "No crew, operator, or owner cookie for this event.", allowed: [], isHost: false };
}

export function viewerCan(viewer: CrewViewer, action: CrewAction) {
  return viewer.allowed === "all" || viewer.allowed.includes(action);
}

/** The sentence for a disabled control, or undefined when the viewer may act. */
export function viewerDenied(viewer: CrewViewer, action: CrewAction): string | undefined {
  if (viewerCan(viewer, action)) return undefined;
  if (viewer.kind === "crew") return crewDeniedReason(viewer.role, action);
  return "Sign in as crew, operator, or owner to use this control.";
}

export async function getCrewViewer(eventId?: string): Promise<CrewViewer> {
  try {
    const env = getEnv();
    const names = getV5AccessCookieNames(env);
    const secret = getV5AccessCookieSecret(env);
    const cookieStore = await cookies();
    const [operator, owner, crew] = await Promise.all([
      readV5AccessCookie(cookieStore.get(names.operatorCookieName)?.value, secret),
      readV5AccessCookie(cookieStore.get(names.ownerCookieName)?.value, secret),
      readV5AccessCookie(cookieStore.get(names.crewCookieName)?.value, secret),
    ]);
    const codeVersion = crew?.kind === "crew" && crew.codeVersion !== undefined && eventId ? (await getHostLinkState(eventId)).codeVersion : 0;
    return crewViewerFromPayloads({ owner, operator, crew }, eventId, codeVersion);
  } catch {
    return crewViewerFromPayloads({}, eventId);
  }
}
