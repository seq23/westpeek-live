import { getClientBySlug, getEvent, getRuntimeData } from "@/lib/runtime/getRuntimeData";
import { ApprovalQueue } from "@/components/approvals/ApprovalQueue";
import { AssetLibrary } from "@/components/assets/AssetLibrary";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatEventDate } from "@/lib/utils/format";
import { peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { ClientRuntimeOverview } from "./ClientRuntimeOverview";

export async function ClientPortalDashboard({ clientSlug, eventId, surface }: { clientSlug: string; eventId?: string; surface?: "reports" }) {
  // A runtime event gets its own honest read-only overview; the seed portal below is for compiled demo events.
  const runtime = eventId ? peekOverlayEvent(eventId) : undefined;
  if (runtime && runtime.source !== "seed") return <ClientRuntimeOverview event={runtime} clientSlug={clientSlug} />;
  const data = getRuntimeData();
  const client = getClientBySlug(clientSlug);
  const events = data.events.filter((event) => event.clientId === client.id);
  const selectedEvent = eventId ? getEvent(eventId) : events[0];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">Client portal</p>
          <h1 className="mt-2 text-3xl font-semibold">{client.name}</h1>
          <p className="mt-2 text-slate-600">A calm, client-facing view of event progress, approvals, timeline, assets, and reports.</p>
        </div>

        <SectionCard title="Your events">
          <div className="grid gap-3 md:grid-cols-2">
            {events.map((event) => (
              <a key={event.id} href={`/client/${client.slug}/events/${event.id}`} className="rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                <p className="font-semibold">{event.name}</p>
                <p className="text-sm text-slate-500">{formatEventDate(event.startAt, event.timezone)}</p>
                <div className="mt-3"><StatusBadge status={event.status} /></div>
              </a>
            ))}
          </div>
        </SectionCard>

        {selectedEvent && surface === "reports" ? (
          <SectionCard title="Reports" eyebrow="Client reports">
            <p className="text-sm text-slate-600">Post-event reports for {selectedEvent.name} are published here once the production team delivers them. {selectedEvent.status === "ended" || selectedEvent.status === "replay_available" ? "The event has ended; the report is being prepared." : "The event has not ended yet, so there is no report to show."}</p>
          </SectionCard>
        ) : null}

        {selectedEvent ? (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <ApprovalQueue eventId={selectedEvent.id} clientFacing />
            <AssetLibrary eventId={selectedEvent.id} clientFacing />
          </div>
        ) : null}
      </div>
    </main>
  );
}
