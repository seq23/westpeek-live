import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { listContacts } from "@/services/attendees/contactsService";

/**
 * People across events: one row per person (keyed by email), with how many events they have
 * attended. Owner only — emails are personal data; an operator sees the count, not the list.
 * CSV export at /api/contacts/export (name, email, company, title, events count, hide flag).
 */
export async function ContactsAcrossEvents({ compact = false }: { compact?: boolean }) {
  const actor = await getWorkspaceActor();
  const contacts = await listContacts().catch(() => []);
  const owner = actor?.kind === "owner";
  return (
    <SectionCard title="People across events" eyebrow={`${contacts.length} ${contacts.length === 1 ? "person" : "people"}`}>
      <div data-testid="contacts-across-events" data-count={contacts.length}>
        <p className="text-sm text-slate-600">One row per person, by email, across every event they registered for. Registering again at a new event updates the person; it never makes a second one. Rows registered before 16 Sep 2026 have no email on file until that person registers again.</p>
        {owner ? <a href="/api/contacts/export" className="mt-3 inline-block rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" data-testid="contacts-export-csv">Download CSV</a> : <p className="mt-2 text-xs text-slate-500">The list with emails is for the owner; you see the count.</p>}
        {!contacts.length ? <div className="mt-4"><EmptyState title="No one yet" body="People appear here the first time they register for any event." /></div> : owner ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Company · title</th><th className="py-2 pr-3">Events</th><th className="py-2">Last seen</th></tr></thead>
              <tbody>
                {contacts.slice(0, compact ? 20 : 500).map((contact) => (
                  <tr key={contact.email} className="border-t border-slate-100" data-testid={`contact-row-${contact.email}`}>
                    <td className="py-2 pr-3 font-bold text-slate-950">{contact.name}{contact.hiddenFromDirectory ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">hidden</span> : null}</td>
                    <td className="py-2 pr-3 text-slate-700"><code className="text-xs">{contact.email}</code></td>
                    <td className="py-2 pr-3 text-slate-600">{[contact.company, contact.title].filter(Boolean).join(" · ")}</td>
                    <td className="py-2 pr-3" data-testid={`contact-events-${contact.email}`}>{contact.eventsAttended.length}</td>
                    <td className="py-2 text-xs text-slate-500">{contact.lastSeenAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
