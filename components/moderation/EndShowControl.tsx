import { endTheShow } from "@/lib/actions/stageStreamActions";
import { findEventRecord } from "@/services/events/eventRepository";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";

/**
 * The primary "End the show" control. Press it BEFORE stopping the feed: the stage is marked
 * intentionally ended and the event goes to `ended`, so the ingress_ended that follows is ENDED,
 * not a Daily failover. Shown on the crew console, the command page, the publish page, and the
 * testing console. Once ended, it reports so instead of offering the button again.
 */
export async function EndShowControl({ eventId, stageId = "main-stage", compact = false }: { eventId: string; stageId?: string; compact?: boolean }) {
  const [state, event] = await Promise.all([
    getOperatorStageStreamState(eventId, stageId),
    findEventRecord(eventId).catch(() => undefined),
  ]);
  const ended = state.operatorMarkedShowEnded || state.streamStatus === "ENDED";
  const eventEnded = event?.status === "ended" || event?.status === "replay_available" || event?.status === "archived";
  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${ended ? "border-slate-200 bg-slate-50" : "border-rose-200 bg-white"}`} data-testid="end-show-control" data-show-ended={ended ? "true" : "false"} data-event-ended={eventEnded ? "true" : "false"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{ended ? "Show ended" : "End of show"}</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{ended ? "The show is marked ended; a stopped feed will not fail over." : "Press before you stop the feed."}</h2>
          {!compact ? <p className="mt-1 max-w-2xl text-sm text-slate-600">{ended ? `Stage: ${state.streamStatus.replaceAll("_", " ")} · Event: ${event?.status || "unknown"}. To run again, use "Reset primary" on the testing console.` : "Marks the show intentionally ended and sets the event to ended. If the RTMP feed stops first, the ladder reads it as a dropped feed and moves attendees to Daily."}</p> : null}
        </div>
        {ended ? (
          <span className="rounded-full bg-slate-200 px-4 py-2 text-sm font-black text-slate-700" data-testid="end-show-ended-badge">ENDED{eventEnded ? " · event ended" : ""}</span>
        ) : (
          <form action={endTheShow}>
            <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="stageId" value={stageId} />
            <button className="rounded-full bg-rose-700 px-5 py-3 text-sm font-black text-white hover:bg-rose-800" data-testid="end-show-button">End the show</button>
          </form>
        )}
      </div>
    </section>
  );
}
