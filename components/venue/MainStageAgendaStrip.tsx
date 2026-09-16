import { LocalTimeWindow } from "@/components/shared/LocalTimeWindow";
import { VenueSection } from "@/components/venue/VenueSection";
import { VenueEmptyState } from "@/components/venue/VenueEmptyState";
import type { VirtualVenueSession } from "@/types/virtualVenue";

function labelFor(session: VirtualVenueSession) {
  if (session.status === "completed") return "Finished";
  if (session.status === "live") return "On now";
  return "Coming up";
}

/**
 * The day's sessions, collapsed by default — the show is what the attendee came for, this is the
 * reference. "Open Run of Show" used to be a button that navigated off a live broadcast; the whole
 * running order now opens in place further down the page, and the standalone page is a footnote
 * for anyone who wants it on its own.
 */
export function MainStageAgendaStrip({ sessions, eventId }: { sessions: VirtualVenueSession[]; eventId?: string }) {
  return (
    <VenueSection storageKey={`agenda-strip-${eventId || "venue"}`} testId="main-stage-agenda-strip" eyebrow="Today" title="What happened, what's on, what's next" summary={sessions.length ? `${sessions.length} session${sessions.length === 1 ? "" : "s"} on the schedule.` : undefined}>
      {sessions.length ? (
        <>
          <div className="mobile-scrollbar flex gap-3 overflow-x-auto pb-1">
            {sessions.map((session) => (
              <a key={session.id} href={session.roomHref} className="min-w-[15rem] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-orange hover:bg-white">
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${session.status === "live" ? "bg-brand-orange text-white" : session.status === "completed" ? "bg-slate-200 text-slate-600" : "bg-white text-slate-700"}`}>{labelFor(session)}</span>
                <p className="mt-3 text-sm font-black text-slate-950">{session.title}</p>
                <p className="mt-1 text-xs text-slate-500"><LocalTimeWindow startsAt={session.startsAt} endsAt={session.endsAt} /></p>
              </a>
            ))}
          </div>
          {eventId ? <p className="mt-4 text-xs text-slate-500">The strip at the top of every page says what is on now. <a href={`/venue/${eventId}/run-of-show`} className="font-bold text-brand-orange underline" data-testid="agenda-strip-run-of-show">Open the full running order</a> for the detail.</p> : null}
        </>
      ) : (
        <VenueEmptyState title="No sessions are scheduled yet." line="Everything today is happening on the main stage. The schedule appears here as soon as the production team publishes it." actionHref={eventId ? `/venue/${eventId}/stage` : undefined} actionLabel="Go to the main stage" />
      )}
    </VenueSection>
  );
}
