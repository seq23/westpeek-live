"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/shared/LocalTime";
import type { LiveChatDelta, LiveChatMessage, LiveChatRoomKind } from "@/types/liveChat";

const POLL_MS = 4_000;

function timeLabel(createdAt: string) {
  return createdAt.includes("T") ? <LocalTime iso={createdAt} /> : createdAt;
}

/**
 * The message list of a live room, kept current by a DELTA poll: every ~4s it asks
 * /api/venue/chat for what changed since the cursor it holds, not for the window again. A room of
 * five hundred therefore costs one small response per person per poll, and the page never
 * re-renders messages it already has.
 *
 * Three kinds of change arrive on the same cursor: a new message (appended), an id in
 * `removedIds` — hidden by the crew or archived by Clear chat — which disappears here the same as
 * everywhere, and a `clearedAt` that moved, which empties the list at once instead of waiting for
 * five hundred removals. A change in the standing state (locked, silenced, slow mode) asks Next to
 * re-render the server shell, which owns the notices and the composer.
 *
 * Fails soft: a poll that errors is ignored and the list keeps what it has. The first paint is the
 * server-rendered list, so this never gates the page on JavaScript.
 */
export function LiveRoomChatStream({ eventId, roomKind, roomId, initialMessages, initialCursor, locked, silenced, slowModeSeconds, clearedAt }: {
  eventId: string;
  roomKind: LiveChatRoomKind;
  roomId: string;
  initialMessages: LiveChatMessage[];
  initialCursor: string;
  locked: boolean;
  silenced: boolean;
  slowModeSeconds: number;
  clearedAt?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const cursor = useRef(initialCursor);
  // What the server shell was rendered with. When the poll disagrees, the shell is re-rendered.
  const rendered = useRef({ locked, silenced, slowModeSeconds, clearedAt });
  useEffect(() => { setMessages(initialMessages); cursor.current = initialCursor; rendered.current = { locked, silenced, slowModeSeconds, clearedAt }; }, [initialMessages, initialCursor, locked, silenced, slowModeSeconds, clearedAt]);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      let delta: LiveChatDelta;
      try {
        const response = await fetch(`/api/venue/chat?eventId=${encodeURIComponent(eventId)}&roomKind=${roomKind}&roomId=${encodeURIComponent(roomId)}&since=${encodeURIComponent(cursor.current)}`, { cache: "no-store" });
        const json = await response.json();
        if (cancelled || !json?.ok) return;
        delta = json as LiveChatDelta;
      } catch {
        return; // keep the list as it is; the next tick tries again
      }
      const cleared = delta.clearedAt && delta.clearedAt !== rendered.current.clearedAt;
      cursor.current = delta.cursor;
      if (delta.messages.length || delta.removedIds.length || cleared) {
        const removed = new Set(delta.removedIds);
        setMessages((current) => {
          const byId = new Map((cleared ? [] : current).filter((message) => !removed.has(message.id)).map((message) => [message.id, message] as const));
          for (const message of delta.messages) byId.set(message.id, message);
          return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
        });
      }
      const state = rendered.current;
      if (delta.locked !== state.locked || delta.silenced !== state.silenced || delta.slowModeSeconds !== state.slowModeSeconds || cleared) {
        rendered.current = { locked: delta.locked, silenced: delta.silenced, slowModeSeconds: delta.slowModeSeconds, clearedAt: delta.clearedAt };
        router.refresh();
      }
    }
    const interval = window.setInterval(poll, POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [eventId, roomKind, roomId, router]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-5" data-testid="live-chat-stream" data-message-count={messages.length}>
      {messages.length ? messages.map((message) => (
        <article key={message.id} className={`rounded-2xl p-4 ${message.moderationStatus === "hidden" ? "border border-dashed border-rose-200 bg-rose-50/60" : "bg-slate-50"}`} data-testid="live-chat-message" data-message-id={message.id} data-moderation-status={message.moderationStatus}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-950">{message.displayName}</p>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{timeLabel(message.createdAt)}</span>
          </div>
          <p className="text-xs text-slate-500">{message.company || "Registered attendee"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{message.message}</p>
          {message.moderationStatus === "hidden" ? <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-rose-700" data-testid="chat-hidden-tag">Hidden by {message.moderatedBy || "crew"} · attendees cannot see this</p> : null}
        </article>
      )) : <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500" data-testid="live-chat-empty">No messages yet. Start the room conversation.</div>}
    </div>
  );
}
