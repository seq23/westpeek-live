import { getLiveRunOfShowSegments } from "@/services/run-of-show/liveRunOfShowService";

/**
 * The attendee-safe projection of the run of show: the ONLY shape a guest surface may read. It
 * carries the public title, the clock, the room and the client-facing line, and it never carries
 * producer notes, technical cues, backup plans, emergency notes or crew vocabulary — filtering
 * those out by hand at each call site is how one of them eventually leaks.
 *
 * "Now" comes from the real segment clock, not from an assumed index: a segment is on when the
 * viewer's instant sits inside its window. Before the first one starts, nothing is on and the next
 * one is what matters; after the last one ends, the show is over and we say so.
 */
export interface AttendeeRunOfShowSegment {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  room: string;
  description: string;
  /** A networking block, so the strip can point at the queue from the row the viewer is reading. */
  networking: boolean;
}

export interface AttendeeRunOfShowView {
  total: number;
  /** 1-based position of the current (or next) segment, for the "3 of 7" cue. */
  position: number;
  now?: AttendeeRunOfShowSegment;
  next?: AttendeeRunOfShowSegment;
  /** True once the last segment's end time has passed. */
  finished: boolean;
  segments: AttendeeRunOfShowSegment[];
}

const NETWORKING = /network|mingle|meet\s*&?\s*greet/i;

function project(segment: { id: string; publicTitle: string; startAt: string; endAt: string; room: string; clientFacingDescription: string }): AttendeeRunOfShowSegment {
  return {
    id: segment.id,
    title: segment.publicTitle,
    startAt: segment.startAt,
    endAt: segment.endAt,
    room: segment.room,
    description: segment.clientFacingDescription,
    networking: NETWORKING.test(segment.publicTitle) || NETWORKING.test(segment.room),
  };
}

export function attendeeRunOfShowView(eventId: string, at: number = Date.now()): AttendeeRunOfShowView {
  const segments = getLiveRunOfShowSegments(eventId)
    .map(project)
    .filter((segment) => segment.title)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  if (!segments.length) return { total: 0, position: 0, finished: false, segments };
  const started = (s: AttendeeRunOfShowSegment) => new Date(s.startAt).getTime() <= at;
  const ended = (s: AttendeeRunOfShowSegment) => new Date(s.endAt).getTime() <= at;
  const nowIndex = segments.findIndex((segment) => started(segment) && !ended(segment));
  const nextIndex = segments.findIndex((segment) => !started(segment));
  const finished = nowIndex < 0 && nextIndex < 0;
  return {
    total: segments.length,
    position: (nowIndex >= 0 ? nowIndex : nextIndex >= 0 ? nextIndex : segments.length - 1) + 1,
    now: nowIndex >= 0 ? segments[nowIndex] : undefined,
    next: nowIndex >= 0 ? segments[nowIndex + 1] : nextIndex >= 0 ? segments[nextIndex] : undefined,
    finished,
    segments,
  };
}
