"use client";
import { useState, useTransition } from "react";
import { getStreamCredentialsAction } from "@/lib/actions/goLiveActions";

/**
 * The RTMP URL and stream key, where the producer actually is. The key is masked until Reveal and
 * never logged. "Copy both for StreamYard" puts two labelled lines on the clipboard with the one
 * instruction that matters: edit the existing Custom RTMP destination, do not add a second.
 *
 * Ending a show releases the key on purpose (a key left behind in someone's StreamYard must not
 * work on the next show), so the empty state says that rather than looking broken.
 */
export function StreamCredentials({ eventId, rtmpUrl, streamKey, ended, problem, canAct, returnTo }: { eventId: string; rtmpUrl?: string; streamKey?: string; ended?: boolean; problem?: string; canAct: boolean; returnTo?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const has = Boolean(rtmpUrl && streamKey);
  const masked = streamKey ? `${streamKey.slice(0, 4)}${"•".repeat(Math.max(10, streamKey.length - 8))}${streamKey.slice(-4)}` : "";

  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(undefined), 1600); } catch { setCopied(`${key}:failed`); }
  }

  function provision() {
    startTransition(async () => {
      const data = new FormData();
      data.set("eventId", eventId);
      if (returnTo) data.set("returnTo", returnTo);
      await getStreamCredentialsAction(data);
    });
  }

  return (
    <div className="mt-4" data-testid="stream-credentials" data-has={has ? "true" : "false"}>
      {has ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-line bg-brand-ash p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-brand-muted">RTMP URL</p>
              <code className="mt-1 block break-all rounded-xl bg-white p-2 text-xs" data-testid="stream-rtmp-url">{rtmpUrl}</code>
              <button type="button" onClick={() => copy(rtmpUrl!, "url")} className="mt-2 rounded-full border border-brand-black px-3 py-1 text-xs font-black" data-testid="copy-rtmp-url">{copied === "url" ? "Copied" : "Copy"}</button>
            </div>
            <div className="rounded-2xl border border-brand-line bg-brand-ash p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-brand-muted">Stream key</p>
              <code className="mt-1 block break-all rounded-xl bg-white p-2 text-xs" data-testid="stream-key" data-revealed={revealed ? "true" : "false"}>{revealed ? streamKey : masked}</code>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setRevealed((value) => !value)} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black" data-testid="reveal-stream-key">{revealed ? "Hide" : "Reveal"}</button>
                <button type="button" onClick={() => copy(streamKey!, "key")} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black" data-testid="copy-stream-key">{copied === "key" ? "Copied" : "Copy"}</button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copy(`RTMP URL: ${rtmpUrl}\nStream key: ${streamKey}\n\nIn StreamYard, EDIT your existing Custom RTMP destination with these — do not add a second one.`, "both")}
              className="rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white"
              data-testid="copy-both-for-streamyard"
            >
              {copied === "both" ? "Copied both" : "Copy both for StreamYard"}
            </button>
            {canAct ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => { if (window.confirm("Get a new stream key? The destination currently set up in StreamYard stops working the moment you do, and you will have to paste the new one in.")) provision(); }}
                className="rounded-full border border-brand-line px-4 py-2 text-xs font-black text-brand-muted disabled:opacity-40"
                data-testid="new-stream-key"
              >
                {pending ? "Working…" : "New stream key"}
              </button>
            ) : null}
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-brand-muted" data-testid="streamyard-steps">
            <li>StreamYard → Destinations → Custom RTMP → edit the West Peek destination.</li>
            <li>Paste the RTMP URL and the stream key above.</li>
            <li>Go live in StreamYard; the stage flips within seconds.</li>
          </ol>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-brand-line p-4" data-testid="stream-credentials-empty">
          <p className="text-sm font-bold text-brand-black">{ended ? "This show has ended. Its stream key was released — get a new one when you are ready to go live again." : "No stream credentials yet."}</p>
          {problem ? <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-bold text-amber-900" data-testid="stream-credentials-problem">LiveKit refused the last attempt: {problem}</p> : null}
          {canAct ? (
            <button type="button" disabled={pending} onClick={provision} className="mt-3 rounded-full bg-brand-black px-4 py-2 text-sm font-black text-white disabled:opacity-40" data-testid="get-stream-credentials">
              {pending ? "Getting them…" : "Get stream credentials"}
            </button>
          ) : <p className="mt-2 text-xs text-brand-muted">Ask the producer or the owner: only they can mint the stream key.</p>}
        </div>
      )}
    </div>
  );
}
