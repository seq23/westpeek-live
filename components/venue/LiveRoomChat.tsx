import { LiveChatComposer } from "@/components/venue/LiveChatComposer";
import { LiveRoomChatStream } from "@/components/venue/LiveRoomChatStream";
import { sendLiveRoomChatMessage } from "@/lib/actions/liveChatActions";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getLiveChatPosterClass } from "@/lib/auth/liveChatPoster";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { getLiveChatAttendeeModeration, getLiveChatPostWindow, getLiveChatRoomModeration, liveChatCursorOf, listLiveRoomChatMessages } from "@/services/venue/liveChatService";
import { LIVE_CHAT_LOCKED_MESSAGE, LIVE_CHAT_SILENCED_MESSAGE, type LiveChatRoomKind } from "@/types/liveChat";

export async function LiveRoomChat({ eventId, roomKind, roomId, title, description }: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; title: string; description: string }) {
  // A crew/operator/owner cookie sees hidden messages (tagged); everyone else is an attendee view.
  const crewAuth = await requireLiveEventControlAccessForRequest(eventId).catch(() => ({ ok: false as const }));
  const viewer = crewAuth.ok ? "crew" : "attendee";
  const [messages, identity, room, posterClass] = await Promise.all([
    listLiveRoomChatMessages(eventId, roomKind, roomId, viewer).catch(() => []),
    getCurrentAttendeeIdentity(eventId).catch(() => undefined),
    getLiveChatRoomModeration(eventId, roomKind, roomId),
    getLiveChatPosterClass(eventId).catch(() => "attendee" as const),
  ]);
  const attendeeModeration = identity ? await getLiveChatAttendeeModeration(eventId, roomKind, roomId, identity.attendeeId) : { silenced: false };
  // When this person may post again: the same numbers the write path will enforce, so the composer
  // never offers a Send that is about to be refused.
  const postWindow = await getLiveChatPostWindow({ eventId, roomKind, roomId, attendeeId: identity?.attendeeId, posterClass, slowModeSeconds: room.slowModeSeconds }).catch(() => ({ exempt: false, nextPostAllowedAt: undefined, cooldownUntil: undefined }));
  const visible = messages;
  return (
    <aside className="flex h-full min-h-[34rem] flex-col rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label={`${title} live chat`} data-testid={`${roomKind}-live-chat`} data-chat-locked={room.locked ? "true" : "false"} data-chat-slow-mode={room.slowModeSeconds}>
      <div className="border-b border-slate-100 p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Live chat</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        {room.locked ? <p className="mt-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-800" data-testid="chat-locked-badge">{LIVE_CHAT_LOCKED_MESSAGE}</p> : null}
        {room.slowModeSeconds ? <p className="mt-3 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-800" data-testid="chat-slow-mode-badge">Slow mode · {room.slowModeSeconds}s between messages</p> : null}
      </div>
      {/* The list is server-rendered first, then kept current by a delta poll — never a refetch of the window. */}
      <LiveRoomChatStream eventId={eventId} roomKind={roomKind} roomId={roomId} initialMessages={visible} initialCursor={liveChatCursorOf(visible)} locked={room.locked} silenced={attendeeModeration.silenced} slowModeSeconds={room.slowModeSeconds} clearedAt={room.clearedAt} />
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
          <LiveChatComposer action={sendLiveRoomChatMessage} eventId={eventId} roomKind={roomKind} roomId={roomId} identityLine={`Posting as ${identity.displayName} · ${identity.company}`} slowModeSeconds={room.slowModeSeconds} nextPostAllowedAt={postWindow.nextPostAllowedAt} cooldownUntil={postWindow.cooldownUntil} exempt={postWindow.exempt} />
        )
      ) : (
        <div className="border-t border-slate-100 p-4 text-sm text-slate-600" data-testid="chat-registration-required"><a href={`/events/${eventId}/register`} className="font-bold text-brand-orange underline">Register for this event</a> to chat with your real attendee identity — it takes 30 seconds and brings you straight back here.</div>
      )}
    </aside>
  );
}
