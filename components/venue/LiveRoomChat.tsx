import { sendLiveRoomChatMessage } from "@/lib/actions/liveChatActions";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { getLiveChatAttendeeModeration, getLiveChatRoomModeration, listLiveRoomChatMessages } from "@/services/venue/liveChatService";
import { LIVE_CHAT_LOCKED_MESSAGE, LIVE_CHAT_SILENCED_MESSAGE, type LiveChatRoomKind } from "@/types/liveChat";

function timeLabel(createdAt: string) {
  return createdAt.includes("T") ? new Date(createdAt).toLocaleTimeString() : createdAt;
}

export async function LiveRoomChat({ eventId, roomKind, roomId, title, description }: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; title: string; description: string }) {
  // A crew/operator/owner cookie sees hidden messages (tagged); everyone else is an attendee view.
  const crewAuth = await requireLiveEventControlAccessForRequest(eventId).catch(() => ({ ok: false as const }));
  const viewer = crewAuth.ok ? "crew" : "attendee";
  const [messages, identity, room] = await Promise.all([
    listLiveRoomChatMessages(eventId, roomKind, roomId, viewer).catch(() => []),
    getCurrentAttendeeIdentity(eventId).catch(() => undefined),
    getLiveChatRoomModeration(eventId, roomKind, roomId),
  ]);
  const attendeeModeration = identity ? await getLiveChatAttendeeModeration(eventId, roomKind, roomId, identity.attendeeId) : { silenced: false };
  const visible = messages;
  return (
    <aside className="flex h-full min-h-[34rem] flex-col rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label={`${title} live chat`} data-testid={`${roomKind}-live-chat`} data-chat-locked={room.locked ? "true" : "false"}>
      <div className="border-b border-slate-100 p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Live chat</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        {room.locked ? <p className="mt-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-800" data-testid="chat-locked-badge">{LIVE_CHAT_LOCKED_MESSAGE}</p> : null}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {visible.length ? visible.map((message) => (
          <article key={message.id} className={`rounded-2xl p-4 ${message.moderationStatus === "hidden" ? "border border-dashed border-rose-200 bg-rose-50/60" : "bg-slate-50"}`} data-testid="live-chat-message" data-message-id={message.id} data-moderation-status={message.moderationStatus}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-950">{message.displayName}</p>
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{timeLabel(message.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-500">{message.company || "Registered attendee"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{message.message}</p>
            {message.moderationStatus === "hidden" ? <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-rose-700" data-testid="chat-hidden-tag">Hidden by {message.moderatedBy || "crew"} · attendees cannot see this</p> : null}
          </article>
        )) : <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No messages yet. Start the room conversation.</div>}
      </div>
      {identity ? (
        attendeeModeration.silenced ? (
          <div className="border-t border-slate-100 p-4" data-testid="chat-silenced-notice">
            <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-900">{LIVE_CHAT_SILENCED_MESSAGE}. Your messages will not be posted to this room.</p>
            <p className="mt-2 text-xs text-slate-500">Posting as {identity.displayName} · {identity.company}</p>
          </div>
        ) : room.locked && viewer !== "crew" ? (
          <div className="border-t border-slate-100 p-4" data-testid="chat-locked-notice">
            <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">{LIVE_CHAT_LOCKED_MESSAGE}. Only the crew can post until it is unlocked.</p>
            <p className="mt-2 text-xs text-slate-500">Posting as {identity.displayName} · {identity.company}</p>
          </div>
        ) : (
          <form action={sendLiveRoomChatMessage} className="border-t border-slate-100 p-4" data-testid="attendee-identity-chat-form">
            <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} />
            <p className="mb-2 text-xs text-slate-500">Posting as {identity.displayName} · {identity.company}</p>
            <label htmlFor={`${roomKind}-${roomId}-chat-message`} className="sr-only">Send a live chat message</label>
            <div className="flex gap-2"><input id={`${roomKind}-${roomId}-chat-message`} name="message" placeholder="Message this room…" className="min-h-11 flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-brand-orange" /><button className="rounded-full bg-slate-950 px-4 text-sm font-black text-white">Send</button></div>
            <p className="mt-2 text-xs text-slate-500">Room-scoped chat: {roomKind}/{roomId}. Crew can hide messages, silence an attendee, or lock this room.</p>
          </form>
        )
      ) : (
        <div className="border-t border-slate-100 p-4 text-sm text-slate-600" data-testid="chat-registration-required">Register for this event to chat with your real attendee identity.</div>
      )}
    </aside>
  );
}
