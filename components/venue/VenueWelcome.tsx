"use client";
import { useEffect, useState } from "react";

/**
 * Exactly one welcome, and only ever one. Tours, coach marks and tooltips get dismissed in two
 * seconds and leave the product just as confusing (the owner: help boxes are not effective), so
 * this names the three things that exist and then gets out of the way for good. The dismissal is
 * per event, not per page, so seeing it on the stage means never seeing it again in the lobby.
 *
 * It replaces FirstVisitCoachStrip. There is no second thing alongside it.
 */
export function VenueWelcome({ eventId, live, networkingOpen }: { eventId: string; live: boolean; networkingOpen: boolean }) {
  const key = `wpl-welcome-${eventId}`;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(window.localStorage.getItem(key) !== "dismissed"); } catch { setVisible(true); }
  }, [key]);
  if (!visible) return null;
  function dismiss() {
    try { window.localStorage.setItem(key, "dismissed"); } catch { /* private mode: it shows again next time */ }
    setVisible(false);
  }
  const base = `/venue/${eventId}`;
  const things = [
    { title: "Watch here", line: live ? "The show is playing on the main stage right now." : "The show plays on the main stage when it starts.", href: `${base}/stage` },
    { title: "Talk here", line: "The chat beside the player is everyone watching. Read it free; register to post.", href: `${base}/stage` },
    { title: "Meet people there", line: networkingOpen ? "Networking is open. We put you on camera with one other person at a time." : "Networking pairs you with one other person on camera when the crew opens it.", href: `${base}/networking` },
  ];
  return (
    <aside className="rounded-2xl border border-brand-orange/40 bg-brand-orangeSoft p-4" data-testid="venue-welcome">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">You&rsquo;re in</p>
        <button type="button" onClick={dismiss} className="-mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-black text-slate-700 hover:bg-white/60" data-testid="venue-welcome-dismiss">Got it</button>
      </div>
      <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-3">
        {things.map((thing) => (
          <li key={thing.title}>
            <a href={thing.href} className="text-sm font-black text-slate-950 underline-offset-2 hover:underline">{thing.title}</a>
            <p className="mt-0.5 text-sm leading-6 text-slate-800">{thing.line}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
