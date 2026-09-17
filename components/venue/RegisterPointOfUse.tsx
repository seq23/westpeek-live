"use client";

import { useId, useState } from "react";

/**
 * The ask at the moment of intent, and nothing before it. Pressing the composer, Join queue, Raise
 * your hand or Use the code explains the ONE thing that press needs, then offers registration.
 *
 * It is folded away until the press, which is what keeps it from becoming a second prompt: the one
 * register invitation (RegisterToTakePart) is already on the page from arrival, and an unregistered
 * viewer must never meet two register buttons on one screen. So the control renders looking like
 * the real control, and the line and the Register link only exist once the person reached for it.
 */
const NEEDS = {
  chat: "Reading along is free. To post, we need your name, email and company.",
  networking: "Networking puts you on camera with one other person, by name, so we need your name, email and company.",
  "stage-request": "To ask the crew to bring you on stage we need your name, email and company.",
  vip: "The VIP code attaches to you, so we need your name, email and company first.",
} as const;

export type RegisterNeed = keyof typeof NEEDS;

export function RegisterPointOfUse({ eventId, need, label, returnTo, variant = "button", testId }: { eventId: string; need: RegisterNeed; label: string; returnTo?: string; variant?: "button" | "field"; testId?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const query = new URLSearchParams({ reason: need, ...(returnTo ? { returnTo } : {}) });
  const control = variant === "field"
    ? "min-h-11 w-full rounded-full border border-slate-200 px-4 text-left text-sm text-slate-500"
    : "min-h-12 rounded-full bg-slate-950 px-6 text-base font-black text-white";
  return (
    <div data-testid={testId} data-register-point-of-use={need} data-register-point-of-use-open={open ? "true" : "false"}>
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls={panelId} className={control} data-testid={`register-point-of-use-${need}`}>{label}</button>
      {open ? (
        <div id={panelId} className="mt-3 rounded-2xl border border-brand-orange/40 bg-brand-orangeSoft p-3" data-testid={`register-point-of-use-${need}-ask`}>
          <p className="text-sm leading-6 text-slate-800">{NEEDS[need]} It takes about fifteen seconds.</p>
          <a href={`/events/${eventId}/register?${query.toString()}`} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid={`register-point-of-use-${need}-cta`}>Register</a>
        </div>
      ) : null}
    </div>
  );
}
