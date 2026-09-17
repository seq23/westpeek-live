import Link from "next/link";
import { MetricCard } from "@/components/shared/MetricCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { RuntimeSchemaStop } from "@/components/system/RuntimeSchemaStop";
import { HouseLogo } from "@/components/brand/HouseLogo";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { getRuntimeSchemaStatus, listClientRecords, listEventRecords } from "@/services/events/eventRepository";
import { getAgencySettings } from "@/services/agencies/agencySettingsService";

function when(iso: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * The owner's cockpit on real rows only. Panels without a real data source
 * yet (approvals, contractor confirmations, reports) say so instead of
 * showing seed data.
 */
export async function AgencyDashboard() {
  const [schema, events, clients, actor, settings] = await Promise.all([
    getRuntimeSchemaStatus(),
    listEventRecords(),
    listClientRecords(),
    getWorkspaceActor(),
    getAgencySettings(),
  ]);
  const live = events.filter((event) => event.status === "live");
  const inMotion = events.filter((event) => !["ended", "replay_available", "archived"].includes(event.status));
  const drafts = events.filter((event) => event.status === "draft");
  const upcoming = inMotion.slice().sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <HouseLogo size="sm" />
        <p className="mt-4 text-sm font-medium text-slate-300">{settings.agencyName} · signed in as {actor?.label || "unknown"}</p>
        <h1 className="mt-2 text-3xl font-semibold">Run West Peek Rooms and client events from one cockpit.</h1>
        <p className="mt-2 max-w-3xl text-slate-300">Start a Room now, plan a client event for later, share the join code, and hand crew, speakers, sponsors, VIPs, and clients their own codes — all from the event row.</p>
        <p className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200" data-testid="persistence-mode">{schema.ok ? `${schema.store} runtime store · tables ready` : `${schema.store} runtime store · migration pending`}</p>
      </div>

      {!schema.ok ? <RuntimeSchemaStop status={schema} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Production Console</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{events.length === 0 ? "Create your first real event." : "Everything starts with New event."}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">The demo venue is training and sales theatre on the same components; it is hidden from your lists unless you ask for it.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/events/new" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange" data-testid="dashboard-new-event">New event</Link>
          <Link href="/app/events" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold">All events</Link>
          <Link href="/venue/demo/lobby" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold">Preview Demo Venue</Link>
          <Link href="/operator-packet" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold">Open Operator Packet</Link>
          <Link href="/production-access/crew" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold">Test Crew Login</Link>
          <Link href="/production-access/special-guest" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold">Test Speaker/Sponsor Login</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Live now" value={live.length} />
        <MetricCard label="Events in motion" value={inMotion.length} />
        <MetricCard label="Drafts" value={drafts.length} />
        <MetricCard label="Clients" value={clients.length} />
      </div>

      <SectionCard title="Your events" eyebrow="Real rows">
        {upcoming.length === 0 ? (
          <EmptyState title="No events yet" body="Press New event. Now gives you a live Room with a join code in one step; Later creates a draft you publish when it is ready." />
        ) : (
          <div className="space-y-3" data-testid="dashboard-events">
            {upcoming.map((event) => (
              <Link key={event.id} href={`/app/events/${event.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50" data-testid={`dashboard-event-${event.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-950">{event.name}</h3>
                    <p className="text-sm text-slate-500">{event.clientName} · {when(event.startAt, event.timezone)} · join code {event.joinCode}</p>
                  </div>
                  <StatusBadge status={event.status} tone={event.status === "live" ? "good" : "neutral"} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <SectionCard title="Pending approvals">
          <EmptyState title="No approval source yet" body="Client approvals will appear here once an event turns on client review. Nothing is pending." />
        </SectionCard>
        <SectionCard title="Contractor confirmations">
          <EmptyState title="No crew assignments recorded" body="Crew reach show-day instructions with the event's crew code; confirmations are not tracked as rows yet." />
        </SectionCard>
        <SectionCard title="Reports due">
          {events.some((event) => event.status === "ended" || event.status === "replay_available") ? (
            <div className="space-y-2">
              {events.filter((event) => event.status === "ended" || event.status === "replay_available").map((event) => (
                <Link key={event.id} href={`/app/events/${event.id}/report`} className="block rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-medium">{event.name}</p>
                  <p className="text-slate-500">Ended · report surface available</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing to report yet" body="Ended events show up here." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
