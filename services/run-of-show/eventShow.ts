import { getEvent, getRunOfShowForEvent, getSpeakersForEvent } from "@/lib/runtime/getRuntimeData";
import { peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { computeShowProgress, type ShowMark, type ShowProgress } from "@/services/run-of-show/showProgress";
import type { RuntimeEventSession } from "@/types/runtimeEvent";

/**
 * THE run of show for one event, as every surface reads it: the producer's tracker, the command
 * centre, the crew run of show, the client portal, the speaker portal and the attendee lobby strip.
 * Segments, who is on in each, and where the show is (clock + the producer's marks) come from here
 * and nowhere else, so two screens can no longer say two different things are on.
 *
 * A real event's segments are its own sessions; a seed (demo) event keeps its compiled run of show.
 * Callers run ensureRuntimeEvent(eventId) first, as every event page already does.
 */
export interface ShowSegmentPerson {
  id: string;
  name: string;
}

export interface ShowSegment {
  /** The run-of-show id the producer's marks are written against. */
  id: string;
  /** The session it came from, for a real event (the id the setup form edits). */
  sessionId?: string;
  title: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  room: string;
  description: string;
  speakerIds: string[];
  speakers: ShowSegmentPerson[];
  host?: string;
  alsoOn?: string;
  cueNotes?: string;
}

export type EventShow = ShowProgress<ShowSegment>;

function minutesBetween(startAt: string, endAt: string) {
  const span = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Number.isFinite(span) ? Math.max(1, Math.round(span / 60_000)) : 0;
}

/** The run-of-show id of a real event's session. The same suffix the run of show has always used, so marks already written still line up. */
export function segmentIdForSession(sessionId: string) {
  return `${sessionId}-segment`;
}

function clean(value: string | undefined) {
  const text = (value || "").trim();
  return text || undefined;
}

/** The demo summit answers to two ids ("demo" in the workspace, "event-summit" in the venue); it is one show. */
const DEMO_IDS = ["demo", "event-summit"];
function seedEventId(eventId: string) {
  return eventId === "demo" ? "event-summit" : eventId;
}
function markEventIds(eventId: string) {
  return DEMO_IDS.includes(eventId) ? DEMO_IDS : [eventId];
}

/** Turn the event's segments into the shape every surface reads. `names` resolves speaker ids. */
export function showSegmentsFor(eventId: string, names: Map<string, string>): ShowSegment[] {
  const people = (ids: string[]) => ids.map((id) => ({ id, name: names.get(id) || "" })).filter((person) => person.name);
  const event = peekOverlayEvent(eventId);
  if (event && event.source !== "seed") {
    const sessions: RuntimeEventSession[] = event.sessions.length ? event.sessions : [{ id: `${event.id}-main-stage`, title: "Main stage", room: "Main Stage", startAt: event.startAt, endAt: event.endAt }];
    return sessions
      .map((session) => {
        const speakerIds = (session.speakerIds || []).filter(Boolean);
        return {
          id: segmentIdForSession(session.id),
          sessionId: session.id,
          title: session.title,
          startAt: session.startAt,
          endAt: session.endAt,
          durationMinutes: minutesBetween(session.startAt, session.endAt),
          room: session.room || "Main Stage",
          description: session.title,
          speakerIds,
          speakers: people(speakerIds),
          host: clean(session.host),
          alsoOn: clean(session.alsoOn),
          cueNotes: clean(session.cueNotes),
        };
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  return getRunOfShowForEvent(seedEventId(eventId))
    .map((segment) => {
      const speakerIds = segment.speakerId ? [segment.speakerId] : [];
      return {
        id: segment.id,
        title: segment.publicTitle,
        startAt: segment.startAt,
        endAt: segment.endAt,
        durationMinutes: segment.durationMinutes,
        room: segment.room,
        description: segment.clientFacingDescription,
        speakerIds,
        speakers: people(speakerIds),
        cueNotes: clean(segment.technicalCues),
      };
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Speaker names by id: the speakers who entered with this event's code, then the demo's own cast. */
export async function speakerNamesFor(eventId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const speaker of getSpeakersForEvent(seedEventId(eventId))) names.set(speaker.id, speaker.name);
  for (const profile of await listGuestProfiles(eventId, "speaker").catch(() => [])) if (profile.name) names.set(profile.guestId, profile.name);
  return names;
}

export async function listShowMarks(eventId: string): Promise<ShowMark[]> {
  const store = getRuntimeStore();
  const rows = (await Promise.all(markEventIds(eventId).map((id) => store.listRunOfShowEvents(id).catch(() => [])))).flat();
  return rows.map((row) => ({ segmentId: row.segmentId, action: row.action, createdAt: row.createdAt }));
}

export async function getEventShow(eventId: string, at: number = Date.now()): Promise<EventShow> {
  const [names, marks] = await Promise.all([speakerNamesFor(eventId), listShowMarks(eventId)]);
  return computeShowProgress(showSegmentsFor(eventId, names), marks, at);
}

/** "Jordan Ellis, Dr. Amara Okafor · host Priya" — the people line every surface prints. */
export function whoIsOn(segment: ShowSegment) {
  const parts = [segment.speakers.map((person) => person.name).join(", "), segment.alsoOn || ""].filter(Boolean);
  const people = parts.join(", ");
  return [people, segment.host ? `host ${segment.host}` : ""].filter(Boolean).join(" · ");
}

/** A speaker's own segments, in order: what the speaker portal's "You're on at…" reads. */
export function segmentsForSpeaker(show: EventShow, speakerId: string) {
  return show.segments.filter((run) => run.segment.speakerIds.includes(speakerId));
}

/** The zone the show's times are printed in: the event's own. */
export function showTimezone(eventId: string) {
  const event = peekOverlayEvent(eventId);
  if (event && event.source !== "seed") return event.timezone;
  return (getEvent(seedEventId(eventId)) as { timezone?: string } | undefined)?.timezone;
}
