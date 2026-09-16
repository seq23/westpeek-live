import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { EMAIL_NOT_CAPTURED_NOTE, type HashOnlyPerson } from "@/services/attendees/contactsService";
import { peopleDirectory } from "@/services/attendees/peopleDirectoryService";
import { PeopleTestRowsToggle } from "@/components/people/PeopleTestRowsToggle";
import { ArchiveTestRowsButton } from "@/components/people/ArchiveTestRowsButton";
import type { ContactRecord } from "@/types/attendeeRegistration";

/**
 * People across events: one row per person (keyed by email), with how many events they attended.
 * The owner's REAL network is the page — our own Playwright and Tier-4 fixtures (test domains,
 * seed/automation events) are counted separately behind "Show test rows" and can be archived.
 * Owner only: emails are personal data; an operator sees the count, not the list.
 * CSV export at /api/contacts/export (real people by default; ?includeTest=1 for everyone).
 */
function ContactTable({ contacts, limit, prefix }: { contacts: ContactRecord[]; limit: number; prefix: string }) {
  if (!contacts.length) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Company · title</th><th className="py-2 pr-3">Events</th><th className="py-2">Last seen</th></tr></thead>
        <tbody>
          {contacts.slice(0, limit).map((contact) => (
            <tr key={contact.email} className="border-t border-slate-100" data-testid={`${prefix}contact-row-${contact.email}`}>
              <td className="py-2 pr-3 font-bold text-slate-950">{contact.name}{contact.hiddenFromDirectory ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">hidden</span> : null}</td>
              <td className="py-2 pr-3 text-slate-700"><code className="text-xs">{contact.email}</code></td>
              <td className="py-2 pr-3 text-slate-600">{[contact.company, contact.title].filter(Boolean).join(" · ")}</td>
              <td className="py-2 pr-3" data-testid={`${prefix}contact-events-${contact.email}`}>{contact.eventsAttended.length}</td>
              <td className="py-2 text-xs text-slate-500">{contact.lastSeenAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HashOnlyTable({ people, limit, prefix }: { people: HashOnlyPerson[]; limit: number; prefix: string }) {
  if (!people.length) return null;
  return (
    <div className="mt-6" data-testid={`${prefix}hash-only-people`} data-count={people.length}>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Registered before the email was kept</p>
      <p className="mt-1 text-sm text-slate-600">{people.length} {people.length === 1 ? "person" : "people"} registered before 16 Sep 2026: their address was stored only as a hash. They are grouped here by that hash across events; the moment they register again anywhere, the email fills in on every row and they move up into the list above.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Company · title</th><th className="py-2 pr-3">Events</th><th className="py-2">Last seen</th></tr></thead>
          <tbody>
            {people.slice(0, limit).map((person) => (
              <tr key={person.emailHash} className="border-t border-slate-100" data-testid={`${prefix}hash-only-row-${person.emailHash.slice(0, 12)}`} data-events={person.events.length}>
                <td className="py-2 pr-3 font-bold text-slate-950">{person.name}{person.hiddenFromDirectory ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">hidden</span> : null}</td>
                <td className="py-2 pr-3 text-slate-700"><code className="text-xs">{person.emailMasked}</code><span className="ml-2 text-xs text-slate-500">{EMAIL_NOT_CAPTURED_NOTE}</span></td>
                <td className="py-2 pr-3 text-slate-600">{[person.company, person.title].filter(Boolean).join(" · ")}</td>
                <td className="py-2 pr-3" data-testid={`${prefix}hash-only-events-${person.emailHash.slice(0, 12)}`}>{person.events.length} · {person.events.map((event) => event.name).join(", ")}</td>
                <td className="py-2 text-xs text-slate-500">{person.lastSeenAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function ContactsAcrossEvents({ compact = false }: { compact?: boolean }) {
  const actor = await getWorkspaceActor();
  const directory = await peopleDirectory();
  const owner = actor?.kind === "owner";
  const limit = compact ? 20 : 500;
  const testEventNames = Array.from(new Set([...directory.test.contacts.flatMap((contact) => contact.eventsAttended), ...directory.test.hashOnly.flatMap((person) => person.events.map((event) => event.id))].map((id) => directory.eventNames[id] || id)));
  return (
    <SectionCard title="People across events" eyebrow={`${directory.realCount} ${directory.realCount === 1 ? "person" : "people"}`}>
      <div data-testid="contacts-across-events" data-count={directory.realCount} data-test-count={directory.testCount} data-contacts={directory.real.contacts.length} data-hash-only={directory.real.hashOnly.length}>
        <p className="text-sm text-slate-600">One row per person, by email, across every event they registered for. Registering again at a new event updates the person; it never makes a second one. Our own test rows (test addresses, seed and automation events) are counted separately below. Rows registered before 16 Sep 2026 have no email on file until that person registers again.</p>
        {owner ? (
          <p className="mt-3">
            <a href="/api/contacts/export" className="inline-block rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" data-testid="contacts-export-csv">Download CSV</a>
            <ArchiveTestRowsButton testCount={directory.testCount} eventNames={testEventNames} />
          </p>
        ) : <p className="mt-2 text-xs text-slate-500">The list with emails is for the owner; you see the count.</p>}
        {!directory.realCount && !directory.testCount ? <div className="mt-4"><EmptyState title="No one yet" body="People appear here the first time they register for any event." /></div> : null}
        {!directory.realCount && directory.testCount ? <div className="mt-4"><EmptyState title="No real people yet" body="Everyone in the store so far is one of our own test rows. Real attendees appear here the first time they register." /></div> : null}
        {owner ? <ContactTable contacts={directory.real.contacts} limit={limit} prefix="" /> : null}
        {owner ? <HashOnlyTable people={directory.real.hashOnly} limit={limit} prefix="" /> : null}
        {owner ? (
          <PeopleTestRowsToggle testCount={directory.testCount}>
            <ContactTable contacts={directory.test.contacts} limit={limit} prefix="test-" />
            <HashOnlyTable people={directory.test.hashOnly} limit={limit} prefix="test-" />
          </PeopleTestRowsToggle>
        ) : null}
      </div>
    </SectionCard>
  );
}
