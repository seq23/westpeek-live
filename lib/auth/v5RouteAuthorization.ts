import type { V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import type { V4CrewRole, V4SpecialGuestRole } from "@/types/v4";
import { crewActionPermissions, type CrewAction } from "@/lib/auth/crewRolePermissions";
import { canViewAsGuest, isViewAsPath } from "@/lib/auth/viewAsGuard";

export { crewActionPermissions };

const roleRoutePrefixes: Record<V4SpecialGuestRole, readonly string[]> = {
  client: ["/client/"],
  speaker: ["/speaker/events/"],
  sponsor: ["/sponsor/events/"],
  crew_lite: ["/crew/events/"],
  vip: ["/venue/"],
};


function segments(pathname: string) {
  return pathname.split("?")[0].split("/").filter(Boolean);
}

export function eventIdFromPath(pathname: string): string | undefined {
  const parts = segments(pathname);
  const eventsIndex = parts.indexOf("events");
  if (eventsIndex >= 0 && parts[eventsIndex + 1]) return parts[eventsIndex + 1];
  if (parts[0] === "venue" && parts[1]) return parts[1];
  if (parts[0] === "admin" && parts[1] === "testing" && parts[2]) return parts[2];
  return undefined;
}

function eventIdsMatch(routeEventId?: string, payloadEventId?: string) {
  if (!routeEventId || !payloadEventId) return true;
  if (routeEventId === payloadEventId) return true;
  if (routeEventId === "demo" && payloadEventId === "event-summit") return true;
  if (routeEventId === "event-summit" && payloadEventId === "demo") return true;
  return false;
}

export function pathIncludesEvent(pathname: string, eventId: string) {
  return eventIdsMatch(eventIdFromPath(pathname), eventId);
}

function clientSlugFromPath(pathname: string): string | undefined {
  const parts = segments(pathname);
  if (parts[0] === "client" && parts[1]) return parts[1];
  return undefined;
}

export function canCrewAccessPath(pathname: string, payload?: V5AccessCookiePayload) {
  if (!payload || payload.kind !== "crew") return false;
  if (!pathname.startsWith("/crew")) return false;
  const pathEventId = eventIdFromPath(pathname);
  if (payload.eventId) return eventIdsMatch(pathEventId, payload.eventId);
  return true;
}

const operatorExactPaths = new Set([
  "/production-access/launchpad",
  "/operator-packet",
  "/app",
  "/app/events",
  "/app/events/new",
  "/app/people",
  "/app/assets",
  "/app/email",
  "/manual",
  "/app/owner",
  "/admin/testing",
  "/admin/testing/demo",
  "/admin/testing/event-summit",
]);

const operatorEventSurfaceSuffixes = new Set([
  "access",
  "agenda",
  "analytics",
  "approval-queue",
  "approvals",
  "assets",
  "attendee-flow",
  "branding",
  "builder",
  "change-control",
  "communications",
  "crew",
  "inbox",
  "incidents",
  "overview",
  "preview",
  "producer",
  "publish",
  "report",
  "run-of-show",
  "setup",
  "speakers",
  "sponsors",
  "talent",
  "tasks",
  "timeline",
  "vendors",
  "venue",
  "video-health",
  "video",
]);

export function canOperatorAccessPath(pathname: string, payload?: V5AccessCookiePayload) {
  if (!payload || payload.kind !== "operator") return false;
  const cleanPath = pathname.split("?")[0];
  if (operatorExactPaths.has(cleanPath)) return true;
  if (cleanPath.startsWith("/admin/testing/")) return true;
  if (cleanPath.startsWith("/crew/events/")) return true;
  const parts = segments(cleanPath);
  if (parts[0] === "app" && parts[1] === "events" && parts[2] && parts[3]) {
    return operatorEventSurfaceSuffixes.has(parts[3]);
  }
  // The per-event command center (no suffix) is where "Create" lands an operator after a planned event is created.
  if (parts[0] === "app" && parts[1] === "events" && parts[2] && parts.length === 3) return true;
  return false;
}

export function canOwnerAccessPath(pathname: string, payload?: V5AccessCookiePayload) {
  if (!payload || payload.kind !== "owner") return false;
  const cleanPath = pathname.split("?")[0];
  return (
    cleanPath === "/billing" ||
    cleanPath.startsWith("/billing/") ||
    cleanPath.startsWith("/app") ||
    cleanPath.startsWith("/admin") ||
    cleanPath.startsWith("/crew") ||
    cleanPath.startsWith("/client") ||
    cleanPath.startsWith("/speaker") ||
    cleanPath.startsWith("/sponsor") ||
    cleanPath.startsWith("/venue") ||
    cleanPath === "/manual" ||
    cleanPath === "/operator-packet" ||
    cleanPath === "/production-access/launchpad"
  );
}

export function canSpecialGuestAccessPath(pathname: string, payload?: V5AccessCookiePayload) {
  if (!payload || payload.kind !== "special_guest" || !payload.eventId || !payload.role) return false;
  const allowedPrefixes = roleRoutePrefixes[payload.role];
  if (!allowedPrefixes?.some((prefix) => pathname.startsWith(prefix))) return false;
  const pathEventId = eventIdFromPath(pathname);
  if (!pathEventId || !eventIdsMatch(pathEventId, payload.eventId)) return false;
  if (payload.role === "client" && payload.clientSlug) return clientSlugFromPath(pathname) === payload.clientSlug;
  return true;
}

/**
 * A guest page opened with `?viewAs=<guestId>` by an operator cookie or a producer / executive
 * producer crew cookie for that event (an owner cookie already opens every guest path). The page
 * itself resolves the guest and renders the banner; this only lets the request through.
 */
export function canViewAsAccessPath(pathname: string, viewAs: string | null | undefined, payloads: { owner?: V5AccessCookiePayload; operator?: V5AccessCookiePayload; crew?: V5AccessCookiePayload }) {
  if (!viewAs || !isViewAsPath(pathname)) return false;
  const pathEventId = eventIdFromPath(pathname);
  if (!pathEventId) return false;
  return canViewAsGuest(payloads, pathEventId).ok;
}

export function canPerformCrewAction(payload: V5AccessCookiePayload | undefined, action: string, eventId?: string) {
  if (!payload || payload.kind !== "crew") return false;
  if (eventId && payload.eventId && !eventIdsMatch(eventId, payload.eventId)) return false;
  const role = (payload.role || "crew") as V4CrewRole;
  return crewActionPermissions[role]?.includes(action as CrewAction) ?? false;
}

export function assertCanPerformCrewAction(payload: V5AccessCookiePayload | undefined, action: string, eventId?: string) {
  if (!canPerformCrewAction(payload, action, eventId)) throw new Error(`Forbidden crew action: ${action}`);
}

export function specialGuestEntryPathFor(pathname: string) {
  if (pathname === "/billing" || pathname.startsWith("/billing/") || pathname === "/app/settings") return "/production-access/owner";
  if (pathname.startsWith("/app") || pathname.startsWith("/admin") || pathname === "/manual") return "/production-access/operator";
  if (pathname.startsWith("/crew")) return "/production-access/crew";
  return "/production-access/special-guest";
}
