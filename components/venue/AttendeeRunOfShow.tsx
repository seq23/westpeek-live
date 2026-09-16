import { getRunOfShowProgressSnapshot } from "@/services/run-of-show";
import { LocalTimeWindow } from "@/components/shared/LocalTimeWindow";
import { VenueSection } from "@/components/venue/VenueSection";
import { VenueEmptyState } from "@/components/venue/VenueEmptyState";
import type { LiveRunOfShowSegment } from "@/types/runOfShowLive";

/**
 * The running order, in place. Clicking "Open Run of Show" used to navigate the attendee off the
 * live show, which is not acceptable during a broadcast (the owner, 16 Sep 2026), so this opens
 * where she already is and sits on every venue page. The standalone /venue/{id}/run-of-show route
 * still works for anyone who lands on it directly.
 *
 * Guest language only: what is on, what is next, what has finished. No completion percentage, no
 * producer cues, no "attendee-safe" — that is our word for a producer's idea of the schedule.
 */
export function AttendeeRunOfShow({ eventId, defaultOpen = false }: { eventId: string; defaultOpen?: boolean }) {
  const snapshot = getRunOfShowProgressSnapshot(eventId);
  const segments = [snapshot.previousSegment, snapshot.currentSegment, ...snapshot.upcomingSegments].filter(Boolean) as LiveRunOfShowSegment[];
  const onNow = snapshot.currentSegment;
  return (
    <VenueSection
      id="run-of-show"
      storageKey={`run-of-show-${eventId}`}
      eyebrow="Running order"
      title="What's on, and what's next"
      summary={onNow ? `On now: ${onNow.publicTitle}` : "The running order for today."}
      defaultOpen={defaultOpen}
      testId="attendee-run-of-show"
    >
      {segments.length ? (
        <>
          <ol className="space-y-3">
            {segments.map((segment) => (
              <li key={segment.id} className={`rounded-2xl border p-4 ${segment.liveStatus === "current" ? "border-brand-orange bg-brand-orangeSoft" : "border-slate-200 bg-slate-50"}`} data-testid="run-of-show-row" data-run-of-show-state={segment.liveStatus === "current" ? "now" : segment.liveStatus === "completed" ? "finished" : "next"}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{segment.liveStatus === "current" ? "On now" : segment.liveStatus === "completed" ? "Finished" : "Coming up"}</p>
                <p className="mt-1 text-base font-black text-slate-950">{segment.publicTitle}</p>
                <p className="mt-1 text-sm text-slate-600"><LocalTimeWindow startsAt={segment.startAt} endsAt={segment.endAt} /> · {segment.room}</p>
                {segment.clientFacingDescription ? <p className="mt-2 text-sm leading-6 text-slate-600">{segment.clientFacingDescription}</p> : null}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-500">Times are shown in your own time zone. You can also <a href={`/venue/${eventId}/run-of-show`} className="font-bold text-brand-orange underline">open the running order on its own page</a>.</p>
        </>
      ) : (
        <VenueEmptyState title="The running order is not published yet." line="The production team publishes it before the show starts. The main stage is the place to be in the meantime." actionHref={`/venue/${eventId}/stage`} actionLabel="Go to the main stage" />
      )}
    </VenueSection>
  );
}

/**
 * The same information, shrunk to one line for the top of the stage, so an attendee never has to
 * leave the player to find out what is happening next.
 */
export function StageUpNext({ eventId }: { eventId: string }) {
  const { currentSegment, nextSegment } = getRunOfShowProgressSnapshot(eventId);
  if (!currentSegment && !nextSegment) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/15 bg-white/10 p-3 text-sm" data-testid="stage-up-next">
      {currentSegment ? <p><span className="text-xs font-black uppercase tracking-[0.18em] text-brand-orange">On now</span> <span className="font-black text-white">{currentSegment.publicTitle}</span> <span className="text-white/70"><LocalTimeWindow startsAt={currentSegment.startAt} endsAt={currentSegment.endAt} /></span></p> : null}
      {nextSegment ? <p><span className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Next</span> <span className="font-black text-white">{nextSegment.publicTitle}</span> <span className="text-white/70"><LocalTimeWindow startsAt={nextSegment.startAt} endsAt={nextSegment.endAt} /></span></p> : null}
      <a href="#run-of-show" className="font-black text-brand-orange underline" data-testid="stage-up-next-open">See the whole running order</a>
    </div>
  );
}
