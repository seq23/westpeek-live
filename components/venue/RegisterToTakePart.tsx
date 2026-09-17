"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A staged ask, never a gate. Watching and reading chat are open to anyone holding the link, which
 * is exactly what makes the later ask work: (1) the panel is beside the chat from arrival, plainly
 * saying what registering gets you; (2) after about 45 seconds of CONTINUOUS WATCHING it lifts
 * into prominence, in the chat column and never over the video, once per person ever; (3) the same
 * words appear at the chat composer, the networking join and the raise-hand control. Once the
 * person is registered every one of these renders nothing, anywhere.
 *
 * Deliberately not built, and not to be added: a modal over the video, any delay before watching,
 * a repeated flash, or an ask that cannot be dismissed. Each trades one registration now for a
 * person who never comes back.
 */
const PROMINENT_AFTER_MS = 45_000;
const WHAT_IT_UNLOCKS = ["Post in the chat", "Join networking", "Show up on the People page", "Raise your hand to speak"];

export function RegisterToTakePart({ eventId, registered, context = "stage", returnTo }: { eventId: string; registered: boolean; context?: "stage" | "chat" | "networking" | "stage-request"; returnTo?: string }) {
  const key = `wpl-register-prompt-${eventId}`;
  const [prominent, setProminent] = useState(false);
  const watched = useRef(0);

  // Visible-tab time, not wall clock: a backgrounded tab must not burn the one shot we get.
  useEffect(() => {
    if (registered || context !== "stage") return;
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
  }, [eventId, key, registered, context]);

  if (registered) return null;
  const line =
    context === "chat" ? "You can read along without signing up. To post, we need your name, email and company."
    : context === "networking" ? "Networking pairs you with another person by name, so we need your name, email and company first."
    : context === "stage-request" ? "To ask the crew to bring you on stage we need your name, email and company."
    : "Keep watching. Nothing is in your way. Registering is what lets you take part.";
  const href = `/events/${eventId}/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <aside
      className={`rounded-2xl border bg-brand-orangeSoft p-4 ${prominent ? "border-brand-orange ring-2 ring-brand-orange motion-safe:animate-in shadow-brand" : "border-brand-orange/40"}`}
      data-testid="register-to-take-part"
      data-register-context={context}
      data-register-prominent={prominent ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-black text-slate-950">Want to join in?</p>
        {prominent ? <button type="button" onClick={() => setProminent(false)} className="-mt-1 shrink-0 rounded-full px-2 py-1 text-xs font-black text-slate-700 hover:bg-white/60" data-testid="register-prompt-dismiss">Not now</button> : null}
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-800">{line} It takes about fifteen seconds.</p>
      {context === "stage" ? <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm font-semibold text-slate-800 sm:grid-cols-2">{WHAT_IT_UNLOCKS.map((item) => <li key={item}>· {item}</li>)}</ul> : null}
      <a href={href} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="register-to-take-part-cta">Register</a>
    </aside>
  );
}
