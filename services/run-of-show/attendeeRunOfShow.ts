import { getEventShow, type EventShow } from "@/services/run-of-show/eventShow";

/**
 * The attendee-safe projection of the run of show: the ONLY shape a guest surface may read. It
 * carries the public title, the clock, the room and the client-facing line, and it never carries
 * producer notes, technical cues, backup plans, emergency notes or crew vocabulary — filtering
 * those out by hand at each call site is how one of them eventually leaks.
 *
 * "Now" and "next" are not decided here. They come from the one reading every surface shares
 * (services/run-of-show/eventShow.ts: the clock plus the producer's marks), so the lobby strip says
 * the same thing is on as the producer's tracker and the command centre. Before the first segment
 * nothing is on and the next one is what matters; after the last one, the show is over and we say so.
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
  /** Where this segment stands: finished, on now, or later (the next one is `view.next`). */
  state: "finished" | "now" | "later";
}

export interface AttendeeRunOfShowView {
  total: number;
  /** 1-based position of the current (or next) segment, for the "3 of 7" cue. */
  position: number;
  now?: AttendeeRunOfShowSegment;
  next?: AttendeeRunOfShowSegment;
  /** True once every segment has finished (or been passed by the producer). */
  finished: boolean;
  segments: AttendeeRunOfShowSegment[];
}

const NETWORKING = /network|mingle|meet\s*&?\s*greet/i;

export function attendeeRunOfShowFromShow(show: EventShow): AttendeeRunOfShowView {
  const runs = show.segments.filter((run) => run.segment.title && run.state !== "skipped");
  const segments = runs.map((run): AttendeeRunOfShowSegment => ({
    id: run.segment.id,
    title: run.segment.title,
    startAt: run.segment.startAt,
    endAt: run.segment.endAt,
    room: run.segment.room,
    description: run.segment.description,
    networking: NETWORKING.test(run.segment.title) || NETWORKING.test(run.segment.room),
    state: run.state === "current" ? "now" : run.state === "done" ? "finished" : "later",
  }));
  if (!segments.length) return { total: 0, position: 0, finished: false, segments };
  const now = segments.find((segment) => segment.id === show.current?.segment.id);
  const next = segments.find((segment) => segment.id === show.next?.segment.id);
  const anchor = now || next;
  return {
    total: segments.length,
    position: anchor ? segments.indexOf(anchor) + 1 : segments.length,
    now,
    next,
    finished: !now && !next,
    segments,
  };
}

export async function attendeeRunOfShowView(eventId: string, at: number = Date.now()): Promise<AttendeeRunOfShowView> {
  return attendeeRunOfShowFromShow(await getEventShow(eventId, at));
}
