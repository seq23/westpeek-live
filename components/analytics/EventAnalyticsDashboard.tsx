import { SectionCard } from "@/components/shared/SectionCard";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { findEventRecord } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { V6RuntimeSnapshot } from "@/services/runtime/runtimeStore";

function countByKind(runtime: V6RuntimeSnapshot, eventId: string, kind: string) {
  return runtime.analyticsEvents.filter((event) => event.eventId === eventId && event.kind === kind).length;
}

/**
 * Both dashboards below already counted the runtime store and nothing else; what they still took
 * from the seed module was the event's NAME, so an id the fixtures did not know got the demo
 * summit's title over someone else's numbers. The name now comes from the event repository, which
 * resolves runtime rows and seed rows alike (16 Sep 2026).
 */
export async function EventAnalyticsDashboard({ eventId }: { eventId: string }) {
  const event = await findEventRecord(eventId);
  const runtime = await getRuntimeStore().readSnapshot();
  const analytics = runtime.analyticsEvents.filter((item) => item.eventId === eventId);
  const registrations = runtime.registrations.filter((item) => item.eventId === eventId).length;
  const lobbyJoins = countByKind(runtime, eventId, "attendee_joined_lobby");
  const sessionJoins = countByKind(runtime, eventId, "attendee_joined_session");
  const boothVisits = countByKind(runtime, eventId, "attendee_visited_sponsor_booth");
  const sponsorClicks = countByKind(runtime, eventId, "sponsor_cta_clicked");
  const replayViews = countByKind(runtime, eventId, "replay_watched");
  const networkingJoins = countByKind(runtime, eventId, "networking_joined");
  const supportRequests = runtime.supportRequests.filter((item) => item.eventId === eventId).length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Analytics</p>
        <h1 className="mt-2 text-3xl font-semibold">{event?.name || eventId}</h1>
        <p className="mt-2 text-slate-600">Every number here is a thing that actually happened on this event and was written down. A zero is a real zero — nobody has done that yet — never a placeholder.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Registrations" value={registrations} />
        <MetricCard label="Lobby joins" value={lobbyJoins} />
        <MetricCard label="Session joins" value={sessionJoins} />
        <MetricCard label="Replay views" value={replayViews} />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <SectionCard title="Engagement events">
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard label="Sponsor booth visits" value={boothVisits} />
            <MetricCard label="Sponsor CTA clicks" value={sponsorClicks} />
            <MetricCard label="Networking joins" value={networkingJoins} />
            <MetricCard label="Support requests" value={supportRequests} />
          </div>
        </SectionCard>

        <SectionCard title="Raw event feed">
          <div className="space-y-2">
            {analytics.slice(-8).reverse().map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong>{item.kind}</strong>
                  <StatusBadge status="recorded" tone="good" />
                </div>
                <p className="mt-1 text-slate-500">{item.createdAt}</p>
              </div>
            ))}
            {analytics.length === 0 ? (
              <WorkspaceEmptyState
                testId="analytics-feed-empty"
                title="Nothing has happened on this event yet"
                line="The feed fills in on its own: a registration, someone walking into the lobby, a session join, a booth visit, a replay watched. Publish the event and send the event code, and the first rows appear within seconds."
                actionHref={`/app/events/${eventId}/publish`}
                actionLabel="Open publishing"
              />
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export async function ClientReportBuilder({ eventId }: { eventId: string }) {
  const event = await findEventRecord(eventId);
  const runtime = await getRuntimeStore().readSnapshot();
  const registrations = runtime.registrations.filter((item) => item.eventId === eventId).length;
  const support = runtime.supportRequests.filter((item) => item.eventId === eventId).length;
  const analytics = runtime.analyticsEvents.filter((item) => item.eventId === eventId).length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-sm text-slate-300">Client report builder</p>
        <h1 className="mt-2 text-3xl font-semibold">{event?.name || eventId}</h1>
        <p className="mt-2 text-slate-300">Every figure is counted from what this event actually recorded. Nothing is estimated and nothing is carried over from another event.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Registrations" value={registrations} />
        <MetricCard label="Recorded moments" value={analytics} />
        <MetricCard label="Support requests" value={support} />
      </div>
      {analytics === 0 && registrations === 0 ? (
        <WorkspaceEmptyState
          testId="report-empty"
          title="There is nothing to report yet"
          line="A client report is built from what the event recorded: who registered, who came, what they did. None of that exists for this event yet, and inventing numbers to fill the page would be worse than an empty one. Come back after the show, or after the first registrations land."
          actionHref={`/app/events/${eventId}/analytics`}
          actionLabel="See the live analytics"
        />
      ) : null}
    </div>
  );
}

export async function SponsorReportBuilder() {
  const runtime = await getRuntimeStore().readSnapshot();
  const boothVisits = runtime.analyticsEvents.filter((item) => item.kind === "attendee_visited_sponsor_booth").length;
  const ctaClicks = runtime.analyticsEvents.filter((item) => item.kind === "sponsor_cta_clicked").length;
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm text-slate-500">Sponsor report</p>
          <h1 className="mt-2 text-3xl font-semibold">Runtime sponsor performance</h1>
          <p className="mt-2 text-slate-600">Sponsor report values come from booth and CTA runtime analytics.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard label="Booth visits" value={boothVisits} />
          <MetricCard label="CTA clicks" value={ctaClicks} />
        </div>
      </div>
    </main>
  );
}
