import { formatSessionWindow } from "@/lib/utils/format";
import type { VirtualVenueSession } from "@/types/virtualVenue";

function labelFor(session: VirtualVenueSession) {
  if (session.status === "completed") return "Happened";
  if (session.status === "live") return "Live now";
  return "Upcoming";
}

export function MainStageAgendaStrip({ sessions, eventId }: { sessions: VirtualVenueSession[]; eventId?: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Conference agenda strip">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Conference agenda</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">What happened, what’s live, what’s next</h2>
        </div>
        {eventId ? <a href={`/venue/${eventId}/run-of-show`} className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-brand-orange hover:text-brand-orange sm:inline-flex">Open Run of Show</a> : null}
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {sessions.map((session) => (
          <a key={session.id} href={session.roomHref} className="min-w-[16rem] rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-orange hover:bg-white">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${session.status === "live" ? "bg-brand-orange text-white" : session.status === "completed" ? "bg-slate-200 text-slate-600" : "bg-white text-slate-700"}`}>{labelFor(session)}</span>
            <p className="mt-3 text-sm font-black text-slate-950">{session.title}</p>
            <p className="mt-1 text-xs text-slate-500">{formatSessionWindow(session.startsAt, session.endsAt)}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
