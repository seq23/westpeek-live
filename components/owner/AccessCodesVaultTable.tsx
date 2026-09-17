"use client";
import { useMemo, useState } from "react";
import { adoptReadableCodesAction, setEventAccessCodeAction } from "@/lib/actions/accessCodeActions";
import { recordCodeVaultViewAction } from "@/lib/actions/accessCodeAuditActions";

export interface VaultCode {
  field: string;
  label: string;
  code: string;
  link?: string;
  /**
   * What rotating THIS code will actually cost, in numbers the system holds — "12 registered
   * attendees and 3 people in the venue right now hold the old event code". Where no number exists
   * (we never recorded how many role links were copied out) the line says so instead of guessing.
   * The old confirm said only "links already handed out stop working", which left the owner to
   * guess whether that meant nobody or an audience. See describeCodeChangeImpact.
   */
  impact: string;
}

export type VaultGroupKey = "current" | "ended" | "archived";

export interface VaultEvent {
  id: string;
  name: string;
  status: string;
  codes: VaultCode[];
  /** The six letters every code for this event is built on: WPL-45MINU, WPL-CREW-45MINU … */
  stem: string;
  /** False when a code was set by hand or predates the readable scheme. */
  onScheme: boolean;
  /** Which fold the event sits in: the ones she is running, then Ended, then Archived. */
  group: VaultGroupKey;
  /** The same accounting for "Adopt the readable codes", which changes several codes at once. */
  adoptImpact: string;
}

function mask(field: string, code: string) {
  const prefix = code.includes("-") ? `${code.split("-")[0]}-` : code.slice(0, 3);
  void field;
  return `${prefix}${"•".repeat(Math.max(6, code.length - prefix.length))}`;
}

/**
 * Every code for every event, in one place, behind the owner gate. Masked until Reveal, one click
 * to copy, one click to copy the whole block for a producer, and Rotate right here — which warns,
 * because rotating stops every link and cookie already handed out with the old code.
 */
const GROUPS: Array<{ key: VaultGroupKey; title: string; openByDefault: boolean }> = [
  { key: "current", title: "Running and planned", openByDefault: true },
  { key: "ended", title: "Ended", openByDefault: false },
  { key: "archived", title: "Archived", openByDefault: false },
];

export function AccessCodesVaultTable({ events }: { events: VaultEvent[] }) {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<Partial<Record<VaultGroupKey, boolean>>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | undefined>();
  function renderEvent(event: VaultEvent) {
    const block = [`${event.name}`, ...event.codes.map((code) => `${code.label}: ${code.code}${code.link ? ` — ${code.link}` : ""}`)].join("\n");
    return (
      <li key={event.id} className="rounded-2xl border border-brand-line p-3" data-testid={`vault-event-${event.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-black">{event.name} <span className="ml-2 rounded-full bg-brand-ash px-2 py-0.5 text-[11px] font-black uppercase text-brand-muted">{event.status.replaceAll("_", " ")}</span></p>
          <button type="button" onClick={() => copy(block, `${event.id}:all`, event.id, "all")} className="rounded-full bg-brand-black px-3 py-1 text-xs font-black text-white" data-testid={`vault-copy-all-${event.id}`}>{copied === `${event.id}:all` ? "Copied all codes" : "Copy all codes for this event"}</button>
        </div>
        <p className="mt-1 text-xs text-brand-muted" data-testid={`vault-stem-${event.id}`}>
          Every code for this event is <strong>WPL-[ROLE-]{event.stem}</strong> — the role is written in the code, so there is one stem to remember.{event.onScheme ? "" : " Some codes here were set by hand or predate the scheme."}
        </p>
        {event.onScheme ? null : (
          <form action={adoptReadableCodesAction} className="mt-2" onSubmit={(submit) => { if (!window.confirm(`Give ${event.name} the readable codes (WPL-[ROLE-]${event.stem})?\n\n${event.adoptImpact}\n\nCodes set by hand are kept. An old event code still lands attendees on this event for 90 days, with a line saying it changed; old crew, speaker, sponsor, client and VIP codes are refused from now on.`)) submit.preventDefault(); }}>
            <input type="hidden" name="eventId" value={event.id} />
            <button className="rounded-full border border-brand-black px-3 py-1 text-xs font-black" data-testid={`vault-adopt-${event.id}`}>Adopt the readable codes</button>
          </form>
        )}
        <details className="mt-2 rounded-xl bg-brand-ash p-2 text-xs" data-testid={`vault-custom-${event.id}`}>
          <summary className="cursor-pointer font-black">Set a custom code</summary>
          <form action={setEventAccessCodeAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="eventId" value={event.id} />
            <select name="field" className="rounded-lg border border-brand-line px-2 py-1" data-testid={`vault-custom-field-${event.id}`}>
              {event.codes.map((code) => <option key={code.field} value={code.field}>{code.label}</option>)}
            </select>
            <input name="value" placeholder="4–24 letters, digits, hyphens" className="min-w-[14rem] rounded-lg border border-brand-line px-2 py-1" data-testid={`vault-custom-value-${event.id}`} />
            <button className="rounded-full bg-brand-black px-3 py-1 font-black text-white" data-testid={`vault-custom-save-${event.id}`}>Set it</button>
          </form>
          <p className="mt-1 text-brand-muted">A custom code wins over the generated one and survives &ldquo;Adopt the readable codes&rdquo;. The old code stops opening anything at once; for 90 days it is still recognised, so an old event-code link lands on this event and an old role code is told it was replaced.</p>
        </details>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {event.codes.map((code) => {
            const key = `${event.id}:${code.field}`;
            const open = Boolean(revealed[key]);
            return (
              <li key={key} className="rounded-xl bg-brand-ash p-3 text-sm" data-testid={`vault-code-${event.id}-${code.field}`} data-revealed={open ? "true" : "false"}>
                <p className="text-[11px] font-black uppercase tracking-wide text-brand-muted">{code.label}</p>
                <code className="mt-1 block break-all text-sm font-black" data-testid={`vault-code-value-${event.id}-${code.field}`}>{open ? code.code : mask(code.field, code.code)}</code>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                  <button type="button" onClick={() => { setRevealed((state) => ({ ...state, [key]: !state[key] })); if (!open) void recordCodeVaultViewAction(event.id, code.field, "reveal"); }} className="rounded-full border border-brand-black px-3 py-1" data-testid={`vault-reveal-${event.id}-${code.field}`}>{open ? "Hide" : "Reveal"}</button>
                  <button type="button" onClick={() => copy(code.code, key, event.id, code.field)} className="rounded-full border border-brand-black px-3 py-1" data-testid={`vault-copy-${event.id}-${code.field}`}>{copied === key ? "Copied" : "Copy"}</button>
                  <form action={setEventAccessCodeAction} onSubmit={(submit) => { if (!window.confirm(`Rotate the ${code.label.toLowerCase()} for ${event.name}?\n\n${code.impact}\n\n${code.field === "join" ? "The old event code still lands them on this event for 90 days, with a line saying it changed." : "The old code is refused from now on; whoever holds it is told it was replaced and to ask the producer."}`)) submit.preventDefault(); }}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="field" value={code.field} />
                    <input type="hidden" name="regenerate" value="true" />
                    <button className="rounded-full border border-brand-black px-3 py-1" data-testid={`vault-rotate-${event.id}-${code.field}`}>Rotate</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/[\s-]/g, "");
    if (!needle) return events;
    return events.filter((event) => event.name.toLowerCase().includes(query.trim().toLowerCase()) || event.id.toLowerCase().replace(/[\s-]/g, "").includes(needle) || event.codes.some((code) => code.code.toLowerCase().replace(/[\s-]/g, "").includes(needle)));
  }, [events, query]);

  async function copy(value: string, key: string, eventId: string, field: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(undefined), 1600); } catch { setCopied(`${key}:failed`); }
    void recordCodeVaultViewAction(eventId, field, "copy");
  }

  return (
    <div data-testid="access-codes-vault" data-events={events.length}>
      <p className="text-sm text-brand-muted">Every code lives here, not in any document. Hand one out from this page; rotate it here when the show is over.</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by event name or by a code someone handed you"
        className="mt-3 w-full rounded-xl border border-brand-line px-3 py-2 text-sm"
        data-testid="vault-search"
      />
      {!filtered.length ? <p className="mt-4 text-sm text-brand-muted" data-testid="vault-no-match">No event carries that code or name.</p> : null}
      {GROUPS.map(({ key, title, openByDefault }) => {
        const list = filtered.filter((event) => event.group === key);
        if (!list.length) return null;
        // A search opens the group that holds the hit, so an archived event's code is still findable.
        const open = openByDefault || Boolean(query.trim()) || Boolean(opened[key]);
        return (
          <section key={key} className="mt-4" data-testid={`vault-group-${key}`} data-open={open ? "true" : "false"} data-count={list.length}>
            {openByDefault ? null : (
              <button type="button" onClick={() => setOpened((state) => ({ ...state, [key]: !open }))} className="rounded-full border border-brand-line px-3 py-1 text-xs font-black" data-testid={`vault-group-toggle-${key}`}>
                {open ? "Hide" : "Show"} {title} ({list.length})
              </button>
            )}
            {open ? <ul className="mt-2 space-y-3">{list.map((event) => renderEvent(event))}</ul> : null}
          </section>
        );
      })}
    </div>
  );
}
