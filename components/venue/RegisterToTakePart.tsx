"use client";

import { useEffect, useRef, useState } from "react";

/**
 * THE register invitation. One per page, ever. Every other card that asked an unregistered viewer
 * to register has been folded into this one: the stage used to stack this, the stage panel's own
 * "Keep watching. Want to join in?" and a "My plan" pitch inside one 414px screen, because two
 * pieces of work each added a prompt without knowing about the other (the owner, 16 Sep 2026).
 *
 * A staged ask, never a gate. Watching and reading chat are open to anyone holding the link, which
 * is exactly what makes the later ask work: (1) the panel is beside the chat from arrival, plainly
 * saying what registering gets you; (2) after about 45 seconds of CONTINUOUS WATCHING it lifts
 * into prominence, in the chat column and never over the video, once per person ever. The ask at
 * the moment of intent lives in RegisterPointOfUse, which stays folded away until the person
 * reaches for the thing, so it never becomes a second card beside this one. Once the person is
 * registered every one of them renders nothing, anywhere.
 *
 * Deliberately not built, and not to be added: a modal over the video, any delay before watching,
 * a repeated flash, a second card anywhere on the same page, or an ask that cannot be dismissed.
 * Each trades one registration now for a person who never comes back.
 */
const PROMINENT_AFTER_MS = 45_000;
const WHAT_IT_UNLOCKS = ["Post in the chat", "Join networking", "Show up on the People page", "Raise your hand to speak"];

export function RegisterToTakePart({ eventId, registered, returnTo }: { eventId: string; registered: boolean; returnTo?: string }) {
  const key = `wpl-register-prompt-${eventId}`;
  const [prominent, setProminent] = useState(false);
  const watched = useRef(0);

  // Visible-tab time, not wall clock: a backgrounded tab must not burn the one shot we get.
  useEffect(() => {
    if (registered) return;
    try { if (window.localStorage.getItem(key) === "seen") return; } catch { /* private mode: it may fire again */ }
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      watched.current += 1_000;
      if (watched.current >= PROMINENT_AFTER_MS) {
        window.clearInterval(tick);
        setProminent(true);
        try { window.localStorage.setItem(key, "seen"); } catch { /* nothing durable depends on it */ }
      }
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [eventId, key, registered]);

  if (registered) return null;
  const href = `/events/${eventId}/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <aside
      className={`rounded-2xl border bg-brand-orangeSoft p-4 ${prominent ? "border-brand-orange ring-2 ring-brand-orange motion-safe:animate-in shadow-brand" : "border-brand-orange/40"}`}
      data-testid="register-to-take-part"
      data-register-invitation="true"
      data-register-prominent={prominent ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-black text-slate-950">Keep watching. Want to join in?</p>
        {prominent ? <button type="button" onClick={() => setProminent(false)} className="-mt-1 shrink-0 rounded-full px-2 py-1 text-xs font-black text-slate-700 hover:bg-white/60" data-testid="register-prompt-dismiss">Not now</button> : null}
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-800">Watching costs you nothing. Registering with your name, email and company is what lets you take part. It takes about fifteen seconds.</p>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm font-semibold text-slate-800 sm:grid-cols-2">{WHAT_IT_UNLOCKS.map((item) => <li key={item}>· {item}</li>)}</ul>
      <a href={href} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="register-to-take-part-cta">Register</a>
    </aside>
  );
}
