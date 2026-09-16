"use client";
import { useMemo, useState } from "react";
import { setEventAccessCodeAction } from "@/lib/actions/accessCodeActions";
import { recordCodeVaultViewAction } from "@/lib/actions/accessCodeAuditActions";

export interface VaultCode {
  field: string;
  label: string;
  code: string;
  link?: string;
}

export interface VaultEvent {
  id: string;
  name: string;
  status: string;
  codes: VaultCode[];
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
export function AccessCodesVaultTable({ events }: { events: VaultEvent[] }) {
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | undefined>();
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/[\s-]/g, "");
    if (!needle) return events;
    return events.filter((event) => event.name.toLowerCase().includes(query.trim().toLowerCase()) || event.id.includes(needle) || event.codes.some((code) => code.code.toLowerCase().replace(/[\s-]/g, "").includes(needle)));
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
      <ul className="mt-4 space-y-3">
        {filtered.map((event) => {
          const block = [`${event.name}`, ...event.codes.map((code) => `${code.label}: ${code.code}${code.link ? ` — ${code.link}` : ""}`)].join("\n");
          return (
            <li key={event.id} className="rounded-2xl border border-brand-line p-3" data-testid={`vault-event-${event.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">{event.name} <span className="ml-2 rounded-full bg-brand-ash px-2 py-0.5 text-[11px] font-black uppercase text-brand-muted">{event.status.replaceAll("_", " ")}</span></p>
                <button type="button" onClick={() => copy(block, `${event.id}:all`, event.id, "all")} className="rounded-full bg-brand-black px-3 py-1 text-xs font-black text-white" data-testid={`vault-copy-all-${event.id}`}>{copied === `${event.id}:all` ? "Copied all codes" : "Copy all codes for this event"}</button>
              </div>
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
                        <form action={setEventAccessCodeAction} onSubmit={(submit) => { if (!window.confirm(`Rotate the ${code.label.toLowerCase()} for ${event.name}? Every link and every session already handed out with the old code stops working immediately.`)) submit.preventDefault(); }}>
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
        })}
      </ul>
    </div>
  );
}
