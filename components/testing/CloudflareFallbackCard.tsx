"use client";
import { useState } from "react";
import { CopyToClipboardButton } from "@/components/testing/CopyToClipboardButton";

/**
 * Fallback 1, written for the producer who is not us. Everything they need to send StreamYard at
 * Cloudflare Stream is on this card: the RTMPS URL, the stream key (masked until they click
 * Reveal — it is a secret and is never logged), and the five steps in the order they do them.
 * "Test the fallback player" opens the attendee playback URL so they can see it work before the show.
 */
export function CloudflareFallbackCard({ rtmpsUrl, streamKey, playbackUrl, liveInputId, ready, reason, steps }: { rtmpsUrl?: string; streamKey?: string; playbackUrl?: string; liveInputId?: string; ready: boolean; reason: string; steps: string[] }) {
  const [revealed, setRevealed] = useState(false);
  const masked = streamKey ? `${streamKey.slice(0, 4)}${"•".repeat(Math.max(8, streamKey.length - 8))}${streamKey.slice(-4)}` : undefined;
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4" data-testid="cloudflare-fallback-card" data-ready={ready ? "true" : "false"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Fallback 1: Cloudflare Stream</p>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="cloudflare-fallback-readiness">{ready ? "Ready" : "Not configured"}</span>
      </div>
      {ready ? (
        <p className="mt-2 text-sm text-slate-600">If the LiveKit feed fails mid-show, this is where the room goes. Set the destination up in StreamYard <strong>before</strong> the show; moving down takes about ten seconds once both destinations are live.</p>
      ) : (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900" data-testid="cloudflare-fallback-unset">{reason}</p>
      )}
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700" data-testid="cloudflare-fallback-steps">
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">RTMPS URL</p>
          <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-900" data-testid="cloudflare-rtmps-url">{rtmpsUrl || "Not configured on this Worker"}</code>
          <CopyToClipboardButton value={rtmpsUrl} label="RTMPS URL" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Stream key</p>
          <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-900" data-testid="cloudflare-rtmps-key" data-revealed={revealed ? "true" : "false"}>{streamKey ? (revealed ? streamKey : masked) : "Not configured on this Worker"}</code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRevealed((value) => !value)} disabled={!streamKey} className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-800 disabled:cursor-not-allowed disabled:opacity-40" data-testid="cloudflare-rtmps-key-reveal">{revealed ? "Hide" : "Reveal"}</button>
            <CopyToClipboardButton value={streamKey} label="Stream key" />
          </div>
          <p className="mt-2 text-xs text-amber-700">Operator-only. Never put this on an attendee route or in a log.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        {playbackUrl ? <a href={playbackUrl} target="_blank" rel="noreferrer" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" data-testid="cloudflare-test-fallback-player">Test the fallback player</a> : <span data-testid="cloudflare-test-fallback-player-disabled">No playback URL: the attendee player cannot be tested.</span>}
        {liveInputId ? <span>Live input <code>{liveInputId}</code></span> : null}
      </div>
    </section>
  );
}
