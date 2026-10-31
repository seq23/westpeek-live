/**
 * Where the show is, worked out from two things and nothing else: the clock, and the marks the
 * producer pressed on the run of show ("Mark live", "Mark complete", "Skip").
 *
 * It replaces a tracker that decided by POSITION — segment 1 was always done, segment 2 always
 * current and the second-to-last always "delayed 8 min" — so during a real show it said "Welcome"
 * was on while the command centre and the lobby (which read the clock) said the investor panel was
 * (screenshot run, 30 Oct 2026). Every surface that says what is on now reads THIS function, so
 * they cannot disagree again.
 *
 * The rules, in order:
 *  1. A mark beats the clock. A segment whose latest mark is "Mark live" is on, even if the clock
 *     has moved past its slot (that is what running over looks like). If two are marked live, the
 *     most recent mark wins; a live mark is over once a later segment is marked live or complete after it.
 *  2. With no live mark, the clock decides: the segment whose window holds this instant is on,
 *     unless the producer has already marked it complete or skipped it.
 *  3. Everything before the segment that is on (or before the last segment the producer marked)
 *     is over. With no marks at all, a segment is over once its end time has passed.
 *  4. Late is only ever said when it is true: a segment the producer marked live after its start,
 *     a segment still on after its end, or a next segment whose start has passed while something
 *     else is still on. The clock alone can never make the show late — with no marks we do not
 *     know, so we do not say.
 */

/** A minute either side is the normal jitter of a person pressing a button; two is late. */
export const LATE_AFTER_MINUTES = 2;

export type ShowMarkAction = "mark_ready" | "mark_live" | "mark_complete" | "skip" | "delay" | "note";

export interface ShowMark {
  segmentId: string;
  action: ShowMarkAction;
  createdAt: string;
}

export interface ClockSegment {
  id: string;
  startAt: string;
  endAt: string;
}

export type SegmentRunState = "done" | "current" | "upcoming" | "skipped";

export interface SegmentRun<T extends ClockSegment = ClockSegment> {
  segment: T;
  state: SegmentRunState;
  /** "mark" when the producer's own mark set this state; "clock" when the time did. */
  decidedBy: "mark" | "clock";
  /** When the producer marked it live, if they did. */
  actualStartAt?: string;
  /** When the producer marked it complete, if they did. */
  actualEndAt?: string;
  /** Whole minutes it started after its scheduled start (from a live mark); 0 if on time or unknown. */
  startedLateMinutes: number;
  /** Whole minutes past its scheduled end: still on now, or marked complete that late. 0 otherwise. */
  overranMinutes: number;
}

export interface ShowDelay {
  minutes: number;
  /** Plain English, for the producer: "Investor panel is running 6 min over." */
  reason: string;
  segmentId: string;
}

export interface ShowProgress<T extends ClockSegment = ClockSegment> {
  at: string;
  segments: Array<SegmentRun<T>>;
  current?: SegmentRun<T>;
  next?: SegmentRun<T>;
  /** The run just before the current one (or the last one over, between segments). */
  previous?: SegmentRun<T>;
  completedCount: number;
  skippedCount: number;
  total: number;
  /** 1-based position of the current segment, or of the next one when nothing is on. */
  position: number;
  started: boolean;
  finished: boolean;
  /** Present only when the show is actually behind. */
  delay?: ShowDelay;
}

const RUN_ACTIONS = new Set<ShowMarkAction>(["mark_live", "mark_complete", "skip"]);

function time(iso: string | undefined) {
  const value = iso ? new Date(iso).getTime() : Number.NaN;
  return Number.isFinite(value) ? value : Number.NaN;
}

function wholeMinutesAfter(later: number, earlier: number) {
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
  const minutes = Math.floor((later - earlier) / 60_000);
  return minutes >= LATE_AFTER_MINUTES ? minutes : 0;
}

export function computeShowProgress<T extends ClockSegment>(input: T[], marks: ShowMark[], at: number = Date.now()): ShowProgress<T> {
  const segments = [...input].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const total = segments.length;
  const index = new Map(segments.map((segment, position) => [segment.id, position]));

  // Each segment's run marks, oldest first. Marks for a segment that is no longer on the timeline
  // (renamed, deleted) are ignored rather than guessed at.
  const runMarks = new Map<string, ShowMark[]>();
  for (const mark of [...marks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!RUN_ACTIONS.has(mark.action) || !index.has(mark.segmentId)) continue;
    runMarks.set(mark.segmentId, [...(runMarks.get(mark.segmentId) || []), mark]);
  }
  const latest = (id: string) => runMarks.get(id)?.at(-1);
  const lastOf = (id: string, action: ShowMarkAction) => [...(runMarks.get(id) || [])].reverse().find((mark) => mark.action === action);

  // Rule 1: the most recent "Mark live" that has not since been completed or skipped.
  let markedLive = -1;
  let markedLiveAt = "";
  segments.forEach((segment, position) => {
    const mark = latest(segment.id);
    if (mark?.action === "mark_live" && mark.createdAt >= markedLiveAt) {
      markedLive = position;
      markedLiveAt = mark.createdAt;
    }
  });
  // A live mark is superseded once the producer has marked a LATER segment live or complete after
  // it: they moved on without closing this one. Skipping a later segment is a change of plan, not
  // moving on, so it does not end the one that is on.
  if (markedLive >= 0 && segments.some((segment, position) => position > markedLive && (runMarks.get(segment.id) || []).some((mark) => mark.action !== "skip" && mark.createdAt > markedLiveAt))) markedLive = -1;
  // The furthest segment the producer has marked live or complete: the show has reached it. A skip
  // ahead of time is a change of plan and says nothing about where the show is.
  const lastMarked = segments.reduce((found, segment, position) => ((runMarks.get(segment.id) || []).some((mark) => mark.action !== "skip") ? position : found), -1);

  // Rule 2: the clock, but never onto a segment the producer has closed or skipped, or before the
  // furthest one they marked.
  let current = markedLive;
  if (current < 0) {
    current = segments.findIndex((segment, position) => position > lastMarked && latest(segment.id)?.action !== "skip" && time(segment.startAt) <= at && at < time(segment.endAt));
  }

  const runs: Array<SegmentRun<T>> = segments.map((segment, position) => {
    const mark = latest(segment.id);
    const live = lastOf(segment.id, "mark_live");
    const complete = lastOf(segment.id, "mark_complete");
    let state: SegmentRunState;
    let decidedBy: SegmentRun["decidedBy"] = "clock";
    if (mark?.action === "mark_complete") { state = "done"; decidedBy = "mark"; }
    else if (mark?.action === "skip") { state = "skipped"; decidedBy = "mark"; }
    else if (position === current) { state = "current"; decidedBy = position === markedLive ? "mark" : "clock"; }
    else if (markedLive >= 0) state = position < markedLive ? "done" : "upcoming";
    else if (position < lastMarked) state = "done";
    else if (current >= 0) state = position < current ? "done" : "upcoming";
    else state = time(segment.endAt) <= at ? "done" : "upcoming";

    const startedLateMinutes = live && (state === "current" || state === "done") ? wholeMinutesAfter(time(live.createdAt), time(segment.startAt)) : 0;
    const overranMinutes = state === "current"
      ? wholeMinutesAfter(at, time(segment.endAt))
      : state === "done" && complete ? wholeMinutesAfter(time(complete.createdAt), time(segment.endAt)) : 0;
    return {
      segment,
      state,
      decidedBy,
      actualStartAt: live && state !== "upcoming" ? live.createdAt : undefined,
      actualEndAt: complete && state === "done" ? complete.createdAt : undefined,
      startedLateMinutes,
      overranMinutes,
    };
  });

  const currentRun = current >= 0 ? runs[current] : undefined;
  const nextRun = runs.find((run, position) => run.state === "upcoming" && position > current);
  const anchor = current >= 0 ? current : nextRun ? runs.indexOf(nextRun) : total;
  const previousRun = [...runs.slice(0, anchor)].reverse().find((run) => run.state === "done");
  const completedCount = runs.filter((run) => run.state === "done").length;
  const skippedCount = runs.filter((run) => run.state === "skipped").length;

  // Rule 4: the show is behind by the largest true lateness right now, and only then.
  const candidates: ShowDelay[] = [];
  if (currentRun?.overranMinutes) candidates.push({ minutes: currentRun.overranMinutes, segmentId: currentRun.segment.id, reason: `running ${currentRun.overranMinutes} min over its slot` });
  else if (currentRun?.startedLateMinutes) candidates.push({ minutes: currentRun.startedLateMinutes, segmentId: currentRun.segment.id, reason: `started ${currentRun.startedLateMinutes} min late` });
  if (nextRun && markedLive >= 0) {
    const waiting = wholeMinutesAfter(at, time(nextRun.segment.startAt));
    if (waiting) candidates.push({ minutes: waiting, segmentId: nextRun.segment.id, reason: `was due to start ${waiting} min ago` });
  }
  const delay = candidates.sort((a, b) => b.minutes - a.minutes)[0];

  const position = currentRun ? current + 1 : nextRun ? runs.indexOf(nextRun) + 1 : total;
  return {
    at: new Date(at).toISOString(),
    segments: runs,
    current: currentRun,
    next: nextRun,
    previous: previousRun,
    completedCount,
    skippedCount,
    total,
    position,
    started: Boolean(currentRun) || completedCount + skippedCount > 0,
    finished: total > 0 && !currentRun && !nextRun,
    delay,
  };
}

/**
 * How one finished segment ran, for the report. Only a segment the producer marked live can be
 * called on time or late; one the clock alone moved through is "not timed", because nobody wrote
 * down when it really started.
 */
export type SegmentTiming = "on_time" | "late" | "skipped" | "not_timed" | "not_run";

export function segmentTiming(run: SegmentRun): SegmentTiming {
  if (run.state === "skipped") return "skipped";
  if (run.state === "upcoming") return "not_run";
  if (!run.actualStartAt) return "not_timed";
  return run.startedLateMinutes || run.overranMinutes ? "late" : "on_time";
}
