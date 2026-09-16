import { endTheShow } from "@/lib/actions/stageStreamActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { findEventRecord } from "@/services/events/eventRepository";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";
import { COMMAND_CHIP, COMMAND_CHIP_STATIC } from "@/components/command/commandChrome";

/**
 * The primary "End the show" control. Press it BEFORE stopping the feed: the stage is marked
 * intentionally ended and the event goes to `ended`, so the ingress_ended that follows is ENDED,
 * not a Daily failover. Shown on the crew console, the command page, the publish page, and the
 * testing console. Once ended, it reports so instead of offering the button again.
 *
 * `variant="bar"` is the same control sized for the Event Command Bar: one button, same action,
 * same permission — ending a show must not be a different code path depending on where you press.
 */
export async function EndShowControl({ eventId, stageId = "main-stage", compact = false, variant = "card", viewer: givenViewer }: { eventId: string; stageId?: string; compact?: boolean; variant?: "card" | "bar"; viewer?: CrewViewer }) {
  const [state, event, viewer] = await Promise.all([
    getOperatorStageStreamState(eventId, stageId),
    findEventRecord(eventId).catch(() => undefined),
    givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId),
  ]);
  const ended = state.operatorMarkedShowEnded || state.streamStatus === "ENDED";
  const eventEnded = event?.status === "ended" || event?.status === "replay_available" || event?.status === "archived";
  if (variant === "bar") {
    if (ended) return <span className={COMMAND_CHIP_STATIC} data-testid="end-show-control" data-show-ended="true" data-event-ended={eventEnded ? "true" : "false"}>Show ended</span>;
    return (
      <GatedForm viewer={viewer} action="go_live" formAction={endTheShow} testId="end-show-control">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="stageId" value={stageId} />
        <button className={`${COMMAND_CHIP} bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40`} data-testid="end-show-button" title="Press BEFORE you stop the feed: the stage is marked intentionally ended, so a stopped feed is not read as a dropped one.">End show</button>
      </GatedForm>
    );
  }
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
          <GatedForm viewer={viewer} action="go_live" formAction={endTheShow}>
            <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="stageId" value={stageId} />
            <button className="rounded-full bg-rose-700 px-5 py-3 text-sm font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40" data-testid="end-show-button">End the show</button>
          </GatedForm>
        )}
      </div>
      {!ended ? <DeniedNote viewer={viewer} action="go_live" className="mt-3" /> : null}
    </section>
  );
}
