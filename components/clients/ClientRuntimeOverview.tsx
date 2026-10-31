import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatEventDate } from "@/lib/utils/format";
import { getPublishReadiness } from "@/services/events/eventPublishService";
import { getEventShow, showTimezone, whoIsOn } from "@/services/run-of-show/eventShow";
import { getEventReport } from "@/services/reports/eventReport";
import { EventReportView } from "@/components/analytics/EventReportView";
import { formatEventTime } from "@/lib/utils/format";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The client's read-only view of THEIR runtime event: name, status, when, readiness, the run of
 * show, how many people have registered, and who is speaking. No seed data, no demo approvals;
 * honest empty states until the production team fills them in.
 */
export async function ClientRuntimeOverview({ event, clientSlug }: { event: RuntimeEventRecord; clientSlug: string }) {
  const readiness = getPublishReadiness(event.id);
  const ended = event.status === "ended" || event.status === "replay_available" || event.status === "archived";
  const [attendees, speakers, show, report] = await Promise.all([
    getRuntimeStore().listAttendeeProfiles(event.id, 200).catch(() => []),
    listGuestProfiles(event.id, "speaker").catch(() => []),
    getEventShow(event.id),
    ended ? getEventReport(event.id).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const segments = show.segments;
  const timezone = showTimezone(event.id);
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6" data-testid="client-runtime-overview">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Client portal</p>
          <h1 className="mt-2 text-3xl font-semibold">{event.clientName}</h1>
          <p className="mt-2 text-slate-600">A calm, read-only view of event progress for {event.name}. Your production team makes every change; nothing here is editable.</p>
        </div>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Your event</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{event.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{formatEventDate(event.startAt, event.timezone)} · {event.timezone} · {event.format}</p>
            </div>
            <StatusBadge status={event.status} tone={event.status === "live" ? "good" : "neutral"} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Registered attendees</p><p className="text-2xl font-black">{attendees.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Speakers checked in</p><p className="text-2xl font-black">{speakers.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Run of show segments</p><p className="text-2xl font-black">{segments.length}</p></div>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="client-readiness">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Readiness</p>
          <ul className="mt-3 space-y-2">{readiness.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm"><span>{item.label}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "pass" ? "bg-emerald-100 text-emerald-800" : item.status === "warning" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{item.status}</span></li>)}</ul>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="client-run-of-show">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Run of show</p>
          {show.current ? <p className="mt-2 text-sm font-bold text-emerald-800" data-testid="client-ros-now">On now: {show.current.segment.title}</p> : show.finished ? <p className="mt-2 text-sm text-slate-600">The show is over.</p> : null}
          {segments.length ? <ol className="mt-3 space-y-2">{segments.map(({ segment, state }) => <li key={segment.id} className={`rounded-2xl p-3 text-sm ${state === "current" ? "border border-emerald-300 bg-emerald-50" : "bg-slate-50"}`} data-testid="client-ros-row" data-state={state}><span className="font-black">{formatEventTime(segment.startAt, timezone)}</span> · {segment.title} · {segment.room}{state === "current" ? " · on now" : state === "done" ? " · done" : state === "skipped" ? " · skipped" : ""}{whoIsOn(segment) ? <span className="block text-slate-600">{whoIsOn(segment)}</span> : null}</li>)}</ol> : <p className="mt-3 text-sm text-slate-600">The production team has not published a run of show yet.</p>}
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Approvals and assets</p><p className="mt-2 text-sm text-slate-600">Nothing is waiting for your approval. Items appear here when the production team sends them.</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Reports</p><p className="mt-2 text-sm text-slate-600">{ended ? (report?.hasData ? "The event has ended. Below is what it recorded." : "The event has ended. Nothing was recorded for it, so there are no figures to show.") : "The event has not ended yet, so there is no report to show."}</p></div>
        </section>
        {ended && report?.hasData ? <section data-testid="client-report"><EventReportView report={report} /></section> : null}
        <p className="text-xs text-slate-400">Client view for {clientSlug}. Timeline, approvals, assets, and reports pages show the same event state.</p>
      </div>
    </main>
  );
}
