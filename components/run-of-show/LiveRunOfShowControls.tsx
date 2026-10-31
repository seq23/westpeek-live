import { recordRunOfShowControlAction } from "@/lib/actions/runOfShowActions";
import { formatEventTime } from "@/lib/utils/format";
import type { EventShow } from "@/services/run-of-show/eventShow";

/**
 * The producer's three marks. The segment defaults to the one the producer most likely means —
 * the one on now for "Mark complete", the next one for "Mark live" and "Skip" — and any segment can
 * be picked instead. Each mark is read back by the tracker, the command centre, the crew run of
 * show, the client portal and the attendee strip within the next page load.
 */
export function LiveRunOfShowControls({ eventId, show, timezone }: { eventId: string; show: EventShow; timezone?: string }) {
  if (!show.total) return null;
  const preselected = (show.next || show.current)?.segment.id;
  return (
    <form action={recordRunOfShowControlAction} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="ros-controls">
      <p className="text-sm font-medium text-slate-500">Call the show</p>
      <p className="mt-2 text-sm text-slate-600">Your mark overrides the clock. Mark a segment live when it really starts and complete when it really ends; every screen follows within a page load. Without marks, the clock decides.</p>
      <input type="hidden" name="eventId" value={eventId} />
      <label className="mt-4 grid min-w-0 gap-1 text-xs font-bold text-slate-700">
        Segment
        {/* w-full + min-w-0: a select sizes itself to its longest option, and on a phone the long
            segment titles pushed the whole page wider than the screen (browser suite, 30 Oct 2026). */}
        <select name="segmentId" defaultValue={preselected} className="min-h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-300 px-3 text-sm" data-testid="ros-control-segment">
          {show.segments.map((run) => (
            <option key={run.segment.id} value={run.segment.id}>{formatEventTime(run.segment.startAt, timezone)} · {run.segment.title}{run.state === "current" ? " (on now)" : run.state === "done" ? " (done)" : run.state === "skipped" ? " (skipped)" : ""}</option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit" name="label" value="Mark live" data-testid="ros-mark-live">Mark live</button>
        <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900" type="submit" name="label" value="Mark complete" data-testid="ros-mark-complete">Mark complete</button>
        <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900" type="submit" name="label" value="Skip" data-testid="ros-mark-skip">Skip</button>
      </div>
      <a href={`/app/events/${eventId}/incidents`} className="mt-3 inline-flex text-sm font-semibold text-slate-700 underline">Something went wrong? Log it in the incident log</a>
    </form>
  );
}
