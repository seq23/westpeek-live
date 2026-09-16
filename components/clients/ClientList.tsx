import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { RuntimeSchemaStop } from "@/components/system/RuntimeSchemaStop";
import { createClientAction } from "@/lib/actions/eventWorkspaceActions";
import { getRuntimeSchemaStatus, listClientRecords, listEventRecords } from "@/services/events/eventRepository";

/** Real clients only. This form is the one way to create a client (the create-event page can also name a new one). */
export async function ClientList({ createdClientId, error }: { createdClientId?: string; error?: string }) {
  const [schema, clients, events] = await Promise.all([getRuntimeSchemaStatus(), listClientRecords(), listEventRecords({ includeArchived: true })]);
  return (
    <div className="space-y-6">
      {!schema.ok ? <RuntimeSchemaStop status={schema} /> : null}
      {createdClientId ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="client-created-notice">Client {createdClientId} created.</p> : null}
      {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{error}</p> : null}
      <SectionCard title="New client" eyebrow="Clients">
        <form className="grid gap-3 md:grid-cols-2" action={createClientAction} data-testid="create-client-form">
          <input type="hidden" name="returnTo" value="/app/clients" />
          <label className="text-sm font-medium text-slate-700">
            Client name
            <input className="mt-1 w-full rounded-xl border border-slate-200 p-2" name="name" required aria-label="Client name" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Industry
            <input className="mt-1 w-full rounded-xl border border-slate-200 p-2" name="industry" aria-label="Industry" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Primary contact name
            <input className="mt-1 w-full rounded-xl border border-slate-200 p-2" name="primaryContactName" aria-label="Primary contact name" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Primary contact email
            <input className="mt-1 w-full rounded-xl border border-slate-200 p-2" name="primaryContactEmail" type="email" aria-label="Primary contact email" />
          </label>
          <button className="md:col-span-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit" disabled={!schema.ok} data-testid="create-client-submit">Create client</button>
        </form>
      </SectionCard>
      <SectionCard title="Clients" eyebrow="Agency portfolio">
        {clients.length === 0 ? (
          <EmptyState title="No clients yet" body="West Peek's own Rooms need no client. Add one here, or type a new client name when you create a planned event." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {clients.map((client) => {
              const clientEvents = events.filter((event) => event.clientId === client.id);
              return (
                <Link key={client.id} href={`/app/clients/${client.id}`} className="rounded-2xl border border-slate-200 p-4 hover:bg-slate-50" data-testid={`client-card-${client.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">{client.name}</h3>
                    <StatusBadge status={client.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{client.industry || "Industry not set"}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3"><strong>{clientEvents.length}</strong><br />events</div>
                    <div className="rounded-xl bg-slate-50 p-3"><strong>{clientEvents.filter((event) => event.status === "live").length}</strong><br />live</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{client.primaryContactName || "No contact yet"}{client.primaryContactEmail ? ` · ${client.primaryContactEmail}` : ""}</p>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
