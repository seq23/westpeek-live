import { CopyButton } from "@/components/shared/CopyButton";
import { joinLinkFor } from "@/components/events/EventJoinCodePanel";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

const roleRows: Array<{ key: keyof RuntimeEventRecord["accessCodes"]; testId: string; label: string; gate: string; lands: (event: RuntimeEventRecord) => string }> = [
  { key: "crew", testId: "generated-crew-lite-code", label: "Crew", gate: "/production-access/crew (event code + this code, or the global crew password)", lands: (event) => `/crew/events/${event.id}` },
  { key: "speaker", testId: "generated-speaker-code", label: "Speaker", gate: "/production-access/special-guest", lands: (event) => `/speaker/events/${event.id}` },
  { key: "sponsor", testId: "generated-sponsor-code", label: "Sponsor", gate: "/production-access/special-guest", lands: (event) => `/sponsor/events/${event.id}` },
  { key: "vip", testId: "generated-vip-code", label: "VIP", gate: "/production-access/special-guest", lands: (event) => `/venue/${event.id}/lobby` },
  { key: "client", testId: "generated-client-code", label: "Client", gate: "/production-access/special-guest", lands: (event) => `/client/${event.clientSlug}/events/${event.id}` },
];

/** Per-event codes minted at creation and stored on the event row. Shown to workspace actors only. */
export async function EventAccessCodesPanel({ event }: { event: RuntimeEventRecord }) {
  const joinLink = await joinLinkFor(event);
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm" data-testid="generated-event-role-codes">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Access codes for {event.name}</p>
      <p className="mt-2 text-sm text-brand-muted">Minted when the event was created and stored with it. Attendees use the join code; everyone else enters the event code <strong>{event.joinCode}</strong> plus their role code at the gate below.</p>
      <div className="mt-4 rounded-2xl bg-brand-ash p-4">
        <p className="text-xs font-black uppercase tracking-wide text-brand-muted">Attendee join</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-xl font-black" data-testid="access-join-code">{event.joinCode}</span>
          <CopyButton value={event.joinCode} label="Copy code" />
          <CopyButton value={joinLink} label="Copy join link" />
        </div>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {roleRows.map((row) => (
          <div key={row.key} className="rounded-2xl border border-brand-line p-4">
            <dt className="text-xs font-black uppercase tracking-wide text-brand-muted">{row.label}</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-3">
              <code className="rounded bg-brand-ash px-2 py-1 font-mono text-sm font-bold" data-testid={row.testId}>{event.accessCodes[row.key]}</code>
              <CopyButton value={event.accessCodes[row.key]} label="Copy" testId={`copy-${row.key}-code`} />
            </dd>
            <p className="mt-2 text-xs text-brand-muted">Gate: {row.gate} → lands on {row.lands(event)}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
