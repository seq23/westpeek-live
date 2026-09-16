"use client";
import { useEffect, useState } from "react";

export interface CoachItem { title: string; line: string; href?: string; linkLabel?: string }

/**
 * A one-time, dismissible strip for a first visit to a venue surface. Remembered per event and
 * surface in localStorage (a per-viewer convenience; nothing durable depends on it). Rendered
 * hidden until the client knows whether it was dismissed, so it never flashes.
 *
 * It takes either plain lines or "what's here" items — one component, so the lobby's orientation
 * strip and the stage's first-time note are the same thing and read as one product.
 */
export function FirstVisitCoachStrip({ eventId, surface, title, lines = [], items = [] }: { eventId: string; surface: "stage" | "lobby"; title: string; lines?: string[]; items?: CoachItem[] }) {
  const key = `wpl-coach-${surface}-${eventId}`;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(window.localStorage.getItem(key) !== "dismissed"); } catch { setVisible(true); }
  }, [key]);
  function dismiss() {
    try { window.localStorage.setItem(key, "dismissed"); } catch { /* private mode: it just shows again next time */ }
    setVisible(false);
  }
  if (!visible) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-orange/40 bg-brand-orangeSoft p-4 text-slate-950 sm:flex-row sm:items-start sm:justify-between" role="note" data-testid={`coach-strip-${surface}`}>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{title}</p>
        {lines.length ? <ul className="mt-2 space-y-1 text-sm font-semibold">{lines.map((line) => <li key={line}>{line}</li>)}</ul> : null}
        {items.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2" data-testid={`whats-here-${surface}`}>
            {items.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-black">{item.title}</p>
                <p className="mt-0.5 text-sm leading-6">{item.line}{item.href ? <> <a href={item.href} className="font-black text-brand-orange underline">{item.linkLabel || "Open"}</a></> : null}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <button type="button" onClick={dismiss} className="min-h-11 shrink-0 rounded-full border border-slate-950 px-4 text-sm font-black" data-testid={`coach-strip-${surface}-dismiss`}>Got it</button>
    </div>
  );
}
