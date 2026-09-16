"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CueDeckVersion, SpeakerLiveCueState, SpeakerStageState } from "@/types/specialGuest";

interface Snapshot {
  approved: CueDeckVersion | null;
  pendingVersionNumber: number | null;
  liveCue: SpeakerLiveCueState | null;
  stage: SpeakerStageState;
}

/**
 * The speaker's cue-card / teleprompter view: the APPROVED deck for THIS speaker, next / previous
 * card, large type, and — polled every ~5s — a "producer pushed a change" banner when the crew
 * updates the deck while they are live, plus the live cue banner ("wrap in 2 min").
 */
/** `speakerId` is set only in view-as mode: the crew reader polls THAT speaker's deck (the route allows it for a crew cookie). */
export function SpeakerTeleprompterLive({ eventId, initial, fullScreenHref, speakerId }: { eventId: string; initial: Snapshot; fullScreenHref?: string; speakerId?: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [index, setIndex] = useState(0);
  const [changed, setChanged] = useState<string | null>(null);
  const [large, setLarge] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const seenVersion = useRef(initial.approved?.id || "");
  const seenCue = useRef(initial.liveCue?.pushedAt || "");

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/speaker/cue-deck?eventId=${encodeURIComponent(eventId)}${speakerId ? `&speakerId=${encodeURIComponent(speakerId)}` : ""}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.ok) return;
      const next: Snapshot = { approved: json.approved, pendingVersionNumber: json.pendingVersionNumber, liveCue: json.liveCue, stage: json.stage };
      setSnapshot(next);
      const versionId = next.approved?.id || "";
      if (versionId && versionId !== seenVersion.current) {
        if (seenVersion.current) setChanged(`Producer pushed a change: version ${next.approved?.versionNumber} is now live.`);
        seenVersion.current = versionId;
        setIndex(0);
      }
      if (next.liveCue?.pushedAt && next.liveCue.pushedAt !== seenCue.current) seenCue.current = next.liveCue.pushedAt;
    } catch {
      // keep the last good snapshot
    }
  }, [eventId, speakerId]);

  useEffect(() => {
    const interval = window.setInterval(poll, 5_000);
    return () => window.clearInterval(interval);
  }, [poll]);

  const deck = snapshot.approved;
  const cards = deck?.cards || [];
  const card = cards[Math.min(index, Math.max(0, cards.length - 1))];
  return (
    <div className={`space-y-4 ${large ? "fixed inset-0 z-50 overflow-y-auto bg-black p-6" : ""}`} data-testid="speaker-teleprompter" data-version={deck?.versionNumber ?? 0} data-card-index={index} data-hydrated={hydrated ? "true" : "false"}>
      {snapshot.liveCue?.text ? <div className="rounded-3xl bg-brand-orange p-5 text-2xl font-black text-white shadow-lg" role="status" data-testid="live-cue-banner">{snapshot.liveCue.text} <span className="ml-2 text-sm font-bold opacity-80">· from {snapshot.liveCue.pushedBy}</span></div> : null}
      {changed ? <div className="flex items-center justify-between gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="status" data-testid="deck-changed-banner"><span>{changed}</span><button type="button" onClick={() => setChanged(null)} className="rounded-full border border-amber-400 px-3 py-1 text-xs">Got it</button></div> : null}
      <div className={`rounded-3xl p-6 text-white ${large ? "bg-black" : "bg-slate-950"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{deck ? `Approved cue cards · v${deck.versionNumber} · ${deck.author === "producer" ? "producer" : "you"}${deck.approvedBy ? ` · approved by ${deck.approvedBy}` : ""}` : "Cue cards"}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLarge((value) => !value)} className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold" data-testid="teleprompter-large-toggle">{large ? "Exit full screen" : "Full screen"}</button>
            {fullScreenHref && !large ? <a href={fullScreenHref} className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold">Open teleprompter</a> : null}
          </div>
        </div>
        {cards.length ? (
          <div className="mt-6">
            <p className="text-sm text-slate-400" data-testid="teleprompter-card-position">Card {Math.min(index, cards.length - 1) + 1} of {cards.length}</p>
            <h2 className={`mt-2 font-black leading-tight ${large ? "text-6xl" : "text-4xl"}`} data-testid="teleprompter-card-title">{card?.title}</h2>
            {card?.body ? <p className={`mt-4 whitespace-pre-wrap leading-relaxed ${large ? "text-4xl" : "text-2xl"}`} data-testid="teleprompter-card-body">{card.body}</p> : null}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index <= 0} className="rounded-full border border-white/30 px-5 py-3 text-sm font-black disabled:opacity-40" data-testid="teleprompter-prev">Previous</button>
              <button type="button" onClick={() => setIndex((value) => Math.min(cards.length - 1, value + 1))} disabled={index >= cards.length - 1} className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40" data-testid="teleprompter-next">Next card</button>
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-white/10 p-6 text-lg text-slate-200" data-testid="teleprompter-empty">No approved cue cards yet for you. The producer writes them from the command page; anything you paste below waits for their approval.</p>
        )}
        {deck?.talkingPoints?.length ? <div className="mt-6 rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-300">Talking points</p><ul className={`mt-2 list-disc space-y-1 pl-5 ${large ? "text-2xl" : "text-base"}`} data-testid="teleprompter-talking-points">{deck.talkingPoints.map((point, position) => <li key={`${position}-${point}`}>{point}</li>)}</ul></div> : null}
        {deck?.script ? <details className="mt-4 rounded-2xl bg-white/10 p-4"><summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-300">Script</summary><p className={`mt-2 whitespace-pre-wrap leading-relaxed ${large ? "text-3xl" : "text-lg"}`} data-testid="teleprompter-script">{deck.script}</p></details> : null}
        {snapshot.pendingVersionNumber ? <p className="mt-4 text-xs font-bold text-amber-300" data-testid="teleprompter-pending-note">Version {snapshot.pendingVersionNumber} is waiting for producer approval.</p> : null}
      </div>
    </div>
  );
}
