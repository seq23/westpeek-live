import { StatusBadge } from "@/components/shared/StatusBadge";
import { LiveRunOfShowControls } from "@/components/run-of-show/LiveRunOfShowControls";
import { formatEventTime } from "@/lib/utils/format";
import { getEventShow, showTimezone, whoIsOn, type EventShow } from "@/services/run-of-show/eventShow";
import type { SegmentRun } from "@/services/run-of-show/showProgress";
import type { ShowSegment } from "@/services/run-of-show/eventShow";
import { RUN_OF_SHOW_VISIBILITY } from "@/types/runOfShowLive";

const STATE_LABEL: Record<SegmentRun["state"], string> = { done: "Done", current: "On now", upcoming: "Coming up", skipped: "Skipped" };

function runNote(run: SegmentRun<ShowSegment>, timezone?: string) {
  const parts: string[] = [];
  if (run.actualStartAt) parts.push(`started ${formatEventTime(run.actualStartAt, timezone)}${run.startedLateMinutes ? `, ${run.startedLateMinutes} min late` : ""}`);
  if (run.actualEndAt) parts.push(`ended ${formatEventTime(run.actualEndAt, timezone)}${run.overranMinutes ? `, ${run.overranMinutes} min over` : ""}`);
  else if (run.state === "current" && run.overranMinutes) parts.push(`${run.overranMinutes} min over its slot`);
  if (!parts.length && run.state !== "upcoming") parts.push(run.decidedBy === "clock" ? "by the clock" : "marked by the producer");
  return parts.join(" · ");
}

/**
 * The run-of-show tracker. What is done, on and next comes from getEventShow — the clock plus the
 * producer's marks — the same reading the command centre, the crew run of show, the client portal
 * and the attendee strip make. It used to decide by position: segment 1 always done, segment 2
 * always on, the second-to-last always "delayed 8 min".
 */
export async function LiveRunOfShowDashboard({ eventId, viewer = "agency", showControls = false, show: given }: { eventId: string; viewer?: keyof typeof RUN_OF_SHOW_VISIBILITY; showControls?: boolean; show?: EventShow }) {
  const show = given || (await getEventShow(eventId));
  const visibility = RUN_OF_SHOW_VISIBILITY[viewer];
  const timezone = showTimezone(eventId);
  const percent = show.total ? Math.round(((show.completedCount + show.skippedCount) / show.total) * 100) : 0;
  const headline = !show.total
    ? "No segments on the timeline yet"
    : show.current
      ? `On now: ${show.current.segment.title}`
      : show.finished
        ? "The show is over"
        : show.next
          ? `Next: ${show.next.segment.title} at ${formatEventTime(show.next.segment.startAt, timezone)}`
          : "Nothing is on right now";
  return (
    <div className="min-w-0 space-y-6 break-words" data-testid="ros-tracker" data-current-segment={show.current?.segment.id || ""} data-next-segment={show.next?.segment.id || ""} data-delayed={show.delay ? "true" : "false"}>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Run of show progress</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950" data-testid="ros-tracker-headline">{headline}</h2>
        <p className="mt-1 text-sm text-slate-600">{show.completedCount} of {show.total} done{show.skippedCount ? ` · ${show.skippedCount} skipped` : ""}</p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950" style={{ width: `${percent}%` }} /></div>
        {show.delay ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="ros-delay">
            Running about {show.delay.minutes} min behind: {show.segments.find((run) => run.segment.id === show.delay?.segmentId)?.segment.title} {show.delay.reason}.
          </p>
        ) : show.total ? (
          <p className="mt-4 text-sm text-slate-500" data-testid="ros-on-time">{show.segments.some((run) => run.decidedBy === "mark") ? "On schedule by your marks." : "Following the clock. Mark segments live and complete to track real timing."}</p>
        ) : null}
        <ol className="mt-4 space-y-2" data-testid="ros-tracker-rows">
          {show.segments.map((run) => {
            const people = whoIsOn(run.segment);
            const note = runNote(run, timezone);
            return (
              <li key={run.segment.id} className={`rounded-2xl border p-3 ${run.state === "current" ? "border-emerald-300 bg-emerald-50" : run.state === "upcoming" && run.segment.id === show.next?.segment.id ? "border-slate-300 bg-slate-50" : "border-slate-200"}`} data-testid="ros-tracker-row" data-segment-id={run.segment.id} data-state={run.state}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">{formatEventTime(run.segment.startAt, timezone)} · {run.segment.title}</p>
                  <StatusBadge status={run.segment.id === show.next?.segment.id ? "Next" : STATE_LABEL[run.state]} tone={run.state === "current" ? "good" : "neutral"} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{run.segment.room} · {run.segment.durationMinutes} min{people ? ` · ${people}` : ""}{note ? ` · ${note}` : ""}</p>
                {visibility.canSeeTechnicalCues && run.segment.cueNotes ? <p className="mt-2 rounded-xl bg-white p-2 text-xs text-slate-700">Cue: {run.segment.cueNotes}</p> : null}
              </li>
            );
          })}
        </ol>
      </section>
      {showControls && visibility.canControlLiveStatus ? <LiveRunOfShowControls eventId={eventId} show={show} timezone={timezone} /> : null}
    </div>
  );
}
