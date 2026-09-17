"use client";

import { useCallback, useEffect, useState } from "react";
import { LocalTime } from "@/components/shared/LocalTime";
import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";
import { HEALTH_DOT_CLASS, HEALTH_LEVEL_WORD, healthSummary, worstLevel, type HealthLevel, type HealthLogEntry, type HealthSignal } from "@/lib/venue/eventHealth";
import { COMMAND_CHIP_MUTED } from "@/components/command/commandChrome";
import { COMMAND_PANEL } from "@/components/command/commandChrome";

/**
 * One dot on the bar, the worst state of its signals, expanding into the panel (plan §2.3).
 *
 * Everything comes from ONE request to `/api/venue/tick` — nine separate polls would be nine round
 * trips from every open owner page during a show. Before the first tick lands the dot is grey, not
 * green: we have not measured anything yet, and a green dot that means "no data" is the failure
 * this panel exists to prevent.
 */

const POLL_MS = 15_000;

interface Tick { ok: boolean; signals?: HealthSignal[]; log?: HealthLogEntry[]; generatedAt?: string; demonstration?: boolean; error?: string }

export function EventHealthDot({ eventId, stageId = "main-stage", goLiveHref, crewDeckHref }: { eventId: string; stageId?: string; goLiveHref: string; crewDeckHref: string }) {
  const [tick, setTick] = useState<Tick | undefined>();
  const [failedAt, setFailedAt] = useState<string | undefined>();

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/venue/tick?eventId=${encodeURIComponent(eventId)}&stageId=${encodeURIComponent(stageId)}&buildId=${encodeURIComponent(CURRENT_BUILD_ID)}`, { cache: "no-store" });
      const body = (await response.json()) as Tick;
      if (body.ok) { setTick(body); setFailedAt(undefined); return; }
      // Keep the last good reading on screen and SAY the tick failed, rather than blanking the bar.
      setFailedAt(new Date().toISOString());
    } catch {
      setFailedAt(new Date().toISOString());
    }
  }, [eventId, stageId]);

  useEffect(() => {
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  const signals = tick?.signals || [];
  const level: HealthLevel = signals.length ? worstLevel(signals) : "unknown";

  return (
    <details className="relative" data-testid="command-bar-health" data-health-level={level}>
      <summary className={`flex cursor-pointer list-none items-center gap-1.5 ${COMMAND_CHIP_MUTED}`}>
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_DOT_CLASS[level]}`} data-testid="command-bar-health-dot" aria-hidden />
        <span className="hidden sm:inline">{HEALTH_LEVEL_WORD[level]}</span>
        <span className="sr-only">Event health: {HEALTH_LEVEL_WORD[level]}. {signals.length ? healthSummary(signals) : "Not measured yet."}</span>
      </summary>
      <div className={`${COMMAND_PANEL} p-3 xl:right-0 xl:max-h-[32rem] xl:w-[26rem] xl:max-w-[90vw]`}>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-muted">Health</p>
        <p className="mt-1 text-sm font-bold text-brand-black" data-testid="command-bar-health-summary">{signals.length ? healthSummary(signals) : "Nothing measured yet — the first tick has not landed."}</p>
        {/* Said out loud rather than quietly assumed: the probes below judge this event against a
            demonstration's expectations, and the person reading the panel has to know that. */}
        {tick?.demonstration ? <p className="mt-2 rounded-xl bg-brand-orangeSoft p-2 text-xs font-bold text-brand-black" data-testid="command-bar-health-demonstration">Demonstration event. It is shown live with no stream behind it, so the feed and webhook signals are read against that. A real event with this reading is failing.</p> : null}
        {failedAt ? <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-bold text-amber-900" data-testid="command-bar-health-tick-failed">The last health tick failed (<LocalTime iso={failedAt} />). These readings are the last good ones.</p> : null}

        <ul className="mt-3 space-y-2">
          {signals.map((signal) => (
            <li key={signal.key} className="rounded-xl border border-brand-line p-2" data-testid={`health-signal-${signal.key}`} data-level={signal.level}>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT_CLASS[signal.level]}`} aria-hidden />
                <span className="text-sm font-black text-brand-black">{signal.label}</span>
                <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-brand-muted">{HEALTH_LEVEL_WORD[signal.level]}</span>
              </div>
              <p className="mt-1 text-xs text-brand-black">{signal.detail}</p>
              {/* Every signal names where it came from and when: no dot may be read as an assumption. */}
              <p className="mt-1 text-[11px] text-brand-muted" data-testid={`health-source-${signal.key}`}>
                Source: {signal.source} · {signal.checkedAt ? <>checked <LocalTime iso={signal.checkedAt} /></> : "this probe did not run"}
              </p>
              {signal.action && signal.level !== "green" ? <SignalAction action={signal.action} goLiveHref={goLiveHref} crewDeckHref={crewDeckHref} signalKey={signal.key} /> : null}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-black uppercase tracking-[0.25em] text-brand-muted">This show</p>
        {tick?.log?.length ? (
          <ol className="mt-1 space-y-1" data-testid="command-bar-health-log">
            {tick.log.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-xs">
                <LocalTime iso={entry.at} className="shrink-0 font-mono text-brand-muted" />
                <span><strong className="font-black text-brand-black">{entry.headline}</strong> — {entry.detail}</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-1 text-xs text-brand-muted" data-testid="command-bar-health-log-empty">Nothing has happened to this show yet.</p>}
      </div>
    </details>
  );
}

/** The button a producer presses AT the moment they read the problem — not a description of one. */
function SignalAction({ action, goLiveHref, crewDeckHref, signalKey }: { action: NonNullable<HealthSignal["action"]>; goLiveHref: string; crewDeckHref: string; signalKey: string }) {
  const href = action.href || (action.kind === "crew-deck" || action.kind === "fallback" ? crewDeckHref : goLiveHref);
  return (
    <a href={href} className="mt-2 inline-flex rounded-full bg-brand-black px-3 py-1 text-[11px] font-black text-white hover:bg-brand-orange" data-testid={`health-action-${signalKey}`}>
      {action.label}
    </a>
  );
}
