"use client";
import { useEffect, useState } from "react";

/**
 * A one-time, dismissible coach strip for a first visit to a venue surface. Remembered per
 * event and surface in localStorage (a per-viewer convenience; nothing durable depends on it).
 * Rendered hidden until the client knows whether it was dismissed, so it never flashes.
 */
export function FirstVisitCoachStrip({ eventId, surface, title, lines }: { eventId: string; surface: "stage" | "lobby"; title: string; lines: string[] }) {
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
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{title}</p>
        <ul className="mt-2 space-y-1 text-sm font-semibold">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>
      <button type="button" onClick={dismiss} className="min-h-11 shrink-0 rounded-full border border-slate-950 px-4 text-sm font-black" data-testid={`coach-strip-${surface}-dismiss`}>Got it</button>
    </div>
  );
}
