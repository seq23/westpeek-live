import type { V5AccessCookiePayload } from "@/lib/auth/productionAccess";

/**
 * Who may open a special guest's real pages as that guest (`?viewAs=<guestId>`): an owner cookie,
 * an operator cookie for the event, or a crew cookie whose role is producer / executive_producer
 * for the event. Attendees, other guests, and every other crew role: never. Pure, so the
 * middleware, the page resolver, and the unit test share one rule.
 */
export type ViewAsViewer = { ok: true; kind: "owner" | "operator" | "producer"; label: string } | { ok: false };

function eventMatches(cookieEventId: string | undefined, eventId: string | undefined) {
  if (!cookieEventId || !eventId) return true;
  if (cookieEventId === eventId) return true;
  return (cookieEventId === "demo" && eventId === "event-summit") || (cookieEventId === "event-summit" && eventId === "demo");
}

export function canViewAsGuest(input: { owner?: V5AccessCookiePayload; operator?: V5AccessCookiePayload; crew?: V5AccessCookiePayload }, eventId?: string): ViewAsViewer {
  const { owner, operator, crew } = input;
  if (owner?.kind === "owner") return { ok: true, kind: "owner", label: "the owner" };
  if (operator?.kind === "operator" && eventMatches(operator.eventId, eventId)) return { ok: true, kind: "operator", label: "the operator" };
  if (crew?.kind === "crew" && eventMatches(crew.eventId, eventId) && (crew.role === "producer" || crew.role === "executive_producer")) return { ok: true, kind: "producer", label: crew.role === "executive_producer" ? "the executive producer" : "the producer" };
  return { ok: false };
}

/** The guest surfaces `?viewAs=` is honoured on. `/venue` is public; the lobby renders the VIP panel from the param. */
export const VIEW_AS_PATH_PREFIXES = ["/speaker/events/", "/sponsor/events/", "/client/"] as const;

export function isViewAsPath(pathname: string) {
  return VIEW_AS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Keeps `?viewAs=` on a link inside the guest's pages so the producer stays in preview while navigating. */
export function withViewAs(href: string, viewAs?: string) {
  if (!viewAs) return href;
  return `${href}${href.includes("?") ? "&" : "?"}viewAs=${encodeURIComponent(viewAs)}`;
}
