"use client";
import { useEffect, useState } from "react";
import type { LiveChatRoomKind } from "@/types/liveChat";

function secondsUntil(iso: string | undefined, nowMs: number) {
  if (!iso) return 0;
  const until = Date.parse(iso);
  return Number.isFinite(until) ? Math.max(0, Math.ceil((until - nowMs) / 1000)) : 0;
}

/**
 * The attendee's composer, with the slow-mode countdown on it. While the crew has slow mode on and
 * this person is not exempt, Send is disabled and the line under the box says how many seconds are
 * left — the wait is visible instead of being a refusal after the fact.
 *
 * The countdown is a courtesy, not the rule: the same wait is enforced on the write path, so a
 * page with JavaScript off, a stale tab, or a replayed form gets the same answer. `nextPostAllowedAt`
 * and `cooldownUntil` come from the server on every render; submitting also starts the countdown
 * locally so the button does not flash back to enabled before the page comes back.
 */
export function LiveChatComposer({ action, eventId, roomKind, roomId, identityLine, slowModeSeconds, nextPostAllowedAt, cooldownUntil, exempt }: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  roomKind: LiveChatRoomKind;
  roomId: string;
  identityLine: string;
  slowModeSeconds: number;
  nextPostAllowedAt?: string;
  cooldownUntil?: string;
  exempt: boolean;
}) {
  const [waitUntil, setWaitUntil] = useState<string | undefined>(() => [nextPostAllowedAt, cooldownUntil].filter(Boolean).sort().pop());
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => { setWaitUntil([nextPostAllowedAt, cooldownUntil].filter(Boolean).sort().pop()); }, [nextPostAllowedAt, cooldownUntil]);
  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntil(waitUntil, Date.now()));
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [waitUntil]);
  const waiting = secondsLeft > 0;
  const fieldId = `${roomKind}-${roomId}-chat-message`;
  return (
    <form
      action={action}
      className="border-t border-slate-100 p-4"
      data-testid="attendee-identity-chat-form"
      data-slow-mode-seconds={slowModeSeconds}
      data-slow-mode-exempt={exempt ? "true" : "false"}
      data-seconds-left={secondsLeft}
      onSubmit={() => { if (!exempt && slowModeSeconds) setWaitUntil(new Date(Date.now() + slowModeSeconds * 1000).toISOString()); }}
    >
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} />
      <p className="mb-2 text-xs text-slate-500">{identityLine}</p>
      <label htmlFor={fieldId} className="sr-only">Send a live chat message</label>
      <div className="flex gap-2"><input id={fieldId} name="message" placeholder="Message this room…" className="min-h-11 flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-brand-orange" /><button disabled={waiting} className="rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="chat-send-button">{waiting ? `Wait ${secondsLeft}s` : "Send"}</button></div>
      {!exempt && slowModeSeconds ? (
        <p className="mt-2 text-xs font-bold text-amber-800" data-testid="chat-slow-mode-countdown" data-seconds-left={secondsLeft}>{waiting ? `Slow mode: ${secondsLeft} second${secondsLeft === 1 ? "" : "s"} until you can post again.` : `Slow mode is on: ${slowModeSeconds} seconds between messages.`}</p>
      ) : null}
      {exempt && slowModeSeconds ? <p className="mt-2 text-xs text-slate-500" data-testid="chat-slow-mode-exempt">Slow mode ({slowModeSeconds}s) is on for attendees. You are exempt.</p> : null}
      <p className="mt-2 text-xs text-slate-500">Room-scoped chat: {roomKind}/{roomId}. Crew can hide messages, silence an attendee, slow the room, or lock it.</p>
    </form>
  );
}
