/**
 * Which event-scoped surfaces carry the Event Command Bar, and how the event switcher lands you on
 * the SAME KIND of page for another event.
 *
 * "Same kind" matters: an owner comparing two shows on `/crew/events/{a}` wants `/crew/events/{b}`,
 * not a list. Where the page has no counterpart (a venue booth, a session detail, anything with an
 * id of its own that belongs to the first event), the switcher falls back to that event's overview
 * rather than building a URL to a row that does not exist.
 */

export interface EventSurface {
  /** The route prefix, with `{id}` where the event id sits. */
  pattern: string;
  /** What this surface is called on the bar. */
  label: string;
}

export const EVENT_COMMAND_BAR_SURFACES: readonly EventSurface[] = [
  { pattern: "/app/events/{id}", label: "Event workspace" },
  { pattern: "/crew/events/{id}", label: "Crew deck" },
  { pattern: "/venue/{id}", label: "The room" },
  { pattern: "/speaker/events/{id}", label: "Speaker" },
  { pattern: "/sponsor/events/{id}", label: "Sponsor" },
] as const;

/** The overview for an event: where the switcher lands when the current page has no counterpart. */
export function eventOverviewPath(eventId: string) {
  return `/app/events/${eventId}`;
}

export function crewDeckPath(eventId: string) {
  return `/crew/events/${eventId}`;
}

export function stagePath(eventId: string) {
  return `/venue/${eventId}/stage`;
}

/** The surface a pathname belongs to, or undefined when the bar does not belong there. */
export function surfaceForPath(pathname: string, eventId: string): EventSurface | undefined {
  return EVENT_COMMAND_BAR_SURFACES.find((surface) => {
    const base = surface.pattern.replace("{id}", eventId);
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

/**
 * The same kind of page for another event. A trailing segment is carried over only when it is a
 * fixed page name (`/publish`, `/lobby`, `/green-room`); anything that looks like a row id is
 * dropped, because that row belongs to the event you are leaving.
 */
export function switchEventPath(pathname: string, fromEventId: string, toEventId: string): string {
  const surface = surfaceForPath(pathname, fromEventId);
  if (!surface) return eventOverviewPath(toEventId);
  const base = surface.pattern.replace("{id}", fromEventId);
  const tail = pathname.slice(base.length).replace(/^\//, "");
  const target = surface.pattern.replace("{id}", toEventId);
  if (!tail) return target;
  // One fixed page name, no ids: /publish, /lobby, /green-room. Two segments means a row id.
  if (tail.includes("/") || !/^[a-z][a-z-]*$/.test(tail)) return eventOverviewPath(toEventId);
  return `${target}/${tail}`;
}

/**
 * Who the Event Command Bar is for. It carries go live, end show, the access codes and the stream
 * key, so it is owner and operator ONLY — never an attendee who reached `/venue/**`, and never
 * plain crew, who get the deck and its own permissions instead.
 *
 * Kept here, as one predicate, so the bar, the combined health poll and the tests all ask the same
 * question rather than three copies of it drifting apart.
 */
export function commandBarVisibleTo(viewer: { kind: string }) {
  return viewer.kind === "owner" || viewer.kind === "operator";
}
