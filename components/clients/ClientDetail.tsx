import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { findClientRecord, listEventRecords } from "@/services/events/eventRepository";

export async function ClientDetail({ clientId }: { clientId: string }) {
  const client = await findClientRecord(clientId);
  if (!client) notFound();
  const events = (await listEventRecords({ includeArchived: true })).filter((event) => event.clientId === client.id);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Client workspace</p>
            <h1 className="mt-2 text-3xl font-semibold">{client.name}</h1>
            <p className="mt-1 text-slate-500">{client.industry || "Industry not set"}{client.primaryContactName ? ` · ${client.primaryContactName}` : ""}{client.primaryContactEmail ? ` · ${client.primaryContactEmail}` : ""}</p>
            <p className="mt-1 text-xs text-slate-400">Created by {client.createdByLabel}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={client.status} tone="good" />
            <Link href={`/app/events/new?when=later&clientId=${encodeURIComponent(client.id)}`} className="rounded-full bg-brand-black px-4 py-2 text-xs font-bold text-white hover:bg-brand-orange">New event for {client.name}</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <SectionCard title="Client events">
          {events.length === 0 ? (
            <EmptyState title="No events for this client yet" body="Create one with New event and pick this client." />
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <a key={event.id} href={`/app/events/${event.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-sm text-slate-500">{new Date(event.startAt).toLocaleString("en-US", { timeZone: event.timezone })} · event code {event.joinCode}</p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Approvals">
          <EmptyState title="No approval source yet" body="Client approvals appear here once an event turns on client review." />
        </SectionCard>
      </div>
    </div>
  );
}
