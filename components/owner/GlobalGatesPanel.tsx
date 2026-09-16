"use client";
import { useState } from "react";
import { recordCodeVaultViewAction } from "@/lib/actions/accessCodeAuditActions";

/**
 * The gate passwords themselves, behind the owner master key. The owner asked for the real values
 * here because she is the one who has to type them again; the page is owner-only, the values reach
 * no other render path, and Reveal/Copy write an audit row naming the key, never the value.
 *
 * The spare owner key is deliberately not shown: it is held separately.
 */
function mask(value: string) {
  return `${value.slice(0, 2)}${"•".repeat(Math.max(8, value.length - 4))}${value.slice(-2)}`;
}

export function GlobalGatesPanel({ gates, spare }: { gates: Array<{ key: string; label: string; blurb: string; value: string }>; spare: { key: string; label: string; blurb: string; set: boolean } }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | undefined>();
  async function copy(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(undefined), 1600); } catch { setCopied(`${key}:failed`); }
    void recordCodeVaultViewAction("global", key, "copy");
  }
  return (
    <ul className="grid gap-2 text-sm md:grid-cols-2" data-testid="vault-global-gates">
      {gates.map((gate) => {
        const open = Boolean(revealed[gate.key]);
        const set = Boolean(gate.value);
        return (
          <li key={gate.key} className="rounded-2xl border border-brand-line p-3" data-testid={`vault-gate-${gate.key}`} data-set={set ? "true" : "false"} data-revealed={open ? "true" : "false"}>
            <p className="font-black">{gate.label} {set ? null : <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">not set</span>}</p>
            <p className="mt-1 text-xs text-brand-muted">{gate.blurb}</p>
            <code className="mt-2 block break-all rounded-xl bg-brand-ash p-2 text-xs" data-testid={`vault-gate-value-${gate.key}`}>{set ? (open ? gate.value : mask(gate.value)) : "not set on this Worker"}</code>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
              <button type="button" disabled={!set} onClick={() => { setRevealed((state) => ({ ...state, [gate.key]: !state[gate.key] })); if (!open) void recordCodeVaultViewAction("global", gate.key, "reveal"); }} className="rounded-full border border-brand-black px-3 py-1 disabled:opacity-40" data-testid={`vault-gate-reveal-${gate.key}`}>{open ? "Hide" : "Reveal"}</button>
              <button type="button" disabled={!set} onClick={() => copy(gate.key, gate.value)} className="rounded-full border border-brand-black px-3 py-1 disabled:opacity-40" data-testid={`vault-gate-copy-${gate.key}`}>{copied === gate.key ? "Copied" : "Copy"}</button>
            </div>
            <code className="mt-2 block break-all rounded-xl bg-white p-2 text-[11px] text-brand-muted">npx wrangler secret put {gate.key}</code>
          </li>
        );
      })}
      <li className="rounded-2xl border border-brand-line p-3" data-testid={`vault-gate-${spare.key}`} data-set={spare.set ? "true" : "false"}>
        <p className="font-black">{spare.label} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${spare.set ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{spare.set ? "set" : "not set"}</span></p>
        <p className="mt-1 text-xs text-brand-muted">{spare.blurb}</p>
        <code className="mt-2 block break-all rounded-xl bg-brand-ash p-2 text-[11px] text-brand-muted">npx wrangler secret put {spare.key}</code>
      </li>
    </ul>
  );
}
