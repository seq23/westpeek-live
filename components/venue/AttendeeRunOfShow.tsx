import { attendeeRunOfShowView } from "@/services/run-of-show/attendeeRunOfShow";
import { LocalTimeWindow } from "@/components/shared/LocalTimeWindow";
import { VenueEmptyState } from "@/components/venue/VenueEmptyState";

/**
 * The detail behind the strip: every segment of the day, in order, with the times in the viewer's
 * own clock. The strip under the nav is the glance and this is where someone comes to read the
 * whole shape of it, so it is open, complete and never collapsed.
 *
 * Guest language only — what is on, what is next, what has finished. No completion percentage, no
 * producer cues, and never "attendee-safe", which is our word for a producer's idea of a schedule
 * and only made a guest wonder what the unsafe version said (the owner, 16 Sep 2026).
 */
export function AttendeeRunOfShow({ eventId }: { eventId: string }) {
  const view = attendeeRunOfShowView(eventId);
  if (!view.total) {
    return <VenueEmptyState title="The running order is not published yet." line="The production team publishes it before the show starts. The main stage is the place to be in the meantime." actionHref={`/venue/${eventId}/stage`} actionLabel="Go to the main stage" testId="run-of-show-empty" />;
  }
  return (
    <section id="run-of-show" className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="attendee-run-of-show">
      <ol className="space-y-3">
        {view.segments.map((segment) => {
          const state = segment.id === view.now?.id ? "now" : segment.id === view.next?.id ? "next" : new Date(segment.endAt).getTime() <= Date.now() ? "finished" : "later";
          return (
            <li key={segment.id} className={`rounded-2xl border p-4 ${state === "now" ? "border-brand-orange bg-brand-orangeSoft" : "border-slate-200 bg-slate-50"}`} data-testid="run-of-show-row" data-run-of-show-state={state}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{state === "now" ? "On now" : state === "finished" ? "Finished" : state === "next" ? "Next" : "Later"}</p>
              <p className="mt-1 text-base font-black text-slate-950">{segment.title}</p>
              <p className="mt-1 text-sm text-slate-600"><LocalTimeWindow startsAt={segment.startAt} endsAt={segment.endAt} />{segment.room ? ` · ${segment.room}` : ""}</p>
              {segment.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{segment.description}</p> : null}
              {segment.networking ? <a href={`/venue/${eventId}/networking`} className="mt-2 inline-flex text-sm font-black text-emerald-700 underline">Join the networking queue</a> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-slate-500">Times are shown in your own time zone. The strip at the top of every page always says what is on right now.</p>
    </section>
  );
}
