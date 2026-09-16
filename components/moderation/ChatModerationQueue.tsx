import { lockLiveChatRoom, moderateLiveChatMessage, silenceLiveChatAttendee } from "@/lib/actions/liveChatActions";
import { getLiveChatModerationQueue } from "@/services/venue/liveChatService";
import type { LiveChatMessage, LiveChatRoomKind } from "@/types/liveChat";

const DEFAULT_ROOMS: Array<{ roomKind: LiveChatRoomKind; roomId: string; label: string }> = [
  { roomKind: "main_stage", roomId: "main-stage", label: "Main stage chat" },
  { roomKind: "breakout", roomId: "general-breakout", label: "General breakout chat" },
];

function roomLabel(message: Pick<LiveChatMessage, "roomKind" | "roomId">) {
  if (message.roomKind === "main_stage") return "Main stage";
  if (message.roomKind === "breakout") return `Breakout · ${message.roomId}`;
  return `Session · ${message.roomId}`;
}

function timeLabel(createdAt: string) {
  return createdAt.includes("T") ? new Date(createdAt).toLocaleTimeString() : createdAt;
}

function LockForm({ eventId, roomKind, roomId, locked }: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; locked: boolean }) {
  return (
    <form action={lockLiveChatRoom} className="inline">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} /><input type="hidden" name="locked" value={locked ? "false" : "true"} />
      <button className={`rounded-full px-4 py-2 text-xs font-black ${locked ? "border border-emerald-300 text-emerald-800" : "bg-slate-950 text-white"}`} data-testid={`chat-${locked ? "unlock" : "lock"}-${roomKind}-${roomId}`}>{locked ? "Unlock chat" : "Lock chat"}</button>
    </form>
  );
}

function SilenceForm({ eventId, roomKind, roomId, attendeeId, silenced, compact = false }: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; attendeeId: string; silenced: boolean; compact?: boolean }) {
  return (
    <form action={silenceLiveChatAttendee} className="inline">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} /><input type="hidden" name="attendeeId" value={attendeeId} /><input type="hidden" name="silenced" value={silenced ? "false" : "true"} />
      <button className={`rounded-full border px-3 py-1 text-xs font-black ${silenced ? "border-emerald-300 text-emerald-800" : "border-rose-300 text-rose-800"} ${compact ? "" : "px-4 py-2"}`} data-testid={`chat-${silenced ? "unsilence" : "silence"}-${attendeeId}`}>{silenced ? "Unsilence" : "Silence"}</button>
    </form>
  );
}

/**
 * The crew's chat moderation queue: the latest messages across every room of the
 * event with hide / restore and silence / unsilence per row, the lock state of each
 * room, and every attendee currently silenced. Shared by the crew console, the
 * event command page, and the testing console. Server-rendered; every button is a
 * server action guarded by requireLiveEventControlAccessForRequest.
 */
export async function ChatModerationQueue({ eventId, limit = 30, compact = false }: { eventId: string; limit?: number; compact?: boolean }) {
  const queue = await getLiveChatModerationQueue(eventId, limit);
  const lockedKeys = new Set(queue.lockedRooms.map((room) => `${room.roomKind}:${room.roomId}`));
  const rooms = [...DEFAULT_ROOMS];
  for (const locked of queue.lockedRooms) if (!rooms.some((room) => room.roomKind === locked.roomKind && room.roomId === locked.roomId)) rooms.push({ roomKind: locked.roomKind, roomId: locked.roomId, label: roomLabel(locked) });
  const silencedIn = (message: LiveChatMessage) => queue.silencedAttendees.some((state) => state.attendeeId === message.attendeeId && state.roomKind === message.roomKind && state.roomId === message.roomId);
  const hiddenCount = queue.messages.filter((message) => message.moderationStatus === "hidden").length;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="chat-moderation-queue">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Chat moderation queue</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Latest {queue.messages.length} messages · {hiddenCount} hidden · {queue.silencedAttendees.length} silenced · {queue.lockedRooms.length} locked room{queue.lockedRooms.length === 1 ? "" : "s"}</h2>
          {!compact ? <p className="mt-2 text-sm text-slate-600">Hide removes a message from every attendee view (crew still see it tagged). Silence stops one attendee posting in that room. Lock stops everyone but crew posting. Each is reversible from here.</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rooms.map((room) => {
          const locked = lockedKeys.has(`${room.roomKind}:${room.roomId}`);
          const state = queue.lockedRooms.find((item) => item.roomKind === room.roomKind && item.roomId === room.roomId);
          return (
            <div key={`${room.roomKind}:${room.roomId}`} className={`flex items-center justify-between gap-3 rounded-2xl p-4 ${locked ? "border border-amber-200 bg-amber-50" : "bg-slate-50"}`} data-testid={`chat-room-lock-state-${room.roomKind}-${room.roomId}`} data-locked={locked ? "true" : "false"}>
              <div>
                <p className="text-sm font-black text-slate-950">{room.label}</p>
                <p className="text-xs text-slate-600">{locked ? `Locked by ${state?.updatedBy || "crew"} · attendees see "Chat is locked by the crew"` : "Open · attendees can post"}</p>
              </div>
              <LockForm eventId={eventId} roomKind={room.roomKind} roomId={room.roomId} locked={locked} />
            </div>
          );
        })}
      </div>

      {queue.silencedAttendees.length ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4" data-testid="chat-silenced-attendees">
          <p className="text-xs font-black uppercase tracking-wide text-rose-800">Silenced attendees</p>
          <ul className="mt-2 space-y-2 text-sm">
            {queue.silencedAttendees.map((state) => (
              <li key={state.key} className="flex flex-wrap items-center justify-between gap-2">
                <span><code className="text-xs">{state.attendeeId}</code> · {roomLabel(state)} · by {state.updatedBy}{state.reason ? ` · ${state.reason}` : ""}</span>
                <SilenceForm eventId={eventId} roomKind={state.roomKind} roomId={state.roomId} attendeeId={state.attendeeId as string} silenced compact />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 space-y-2" data-testid="chat-moderation-messages">
        {queue.messages.length ? queue.messages.map((message) => {
          const hidden = message.moderationStatus === "hidden";
          const silenced = silencedIn(message);
          return (
            <article key={message.id} className={`rounded-2xl p-4 ${hidden ? "border border-dashed border-rose-200 bg-rose-50/60" : "bg-slate-50"}`} data-testid="chat-moderation-row" data-message-id={message.id} data-moderation-status={message.moderationStatus}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-950">{message.displayName} <span className="font-medium text-slate-500">· {message.company || "Registered attendee"} · {roomLabel(message)}</span></p>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{timeLabel(message.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{message.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {hidden ? <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-rose-800" data-testid="chat-hidden-tag">Hidden by {message.moderatedBy || "crew"}</span> : null}
                <form action={moderateLiveChatMessage} className="inline">
                  <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="messageId" value={message.id} /><input type="hidden" name="roomKind" value={message.roomKind} /><input type="hidden" name="roomId" value={message.roomId} /><input type="hidden" name="action" value={hidden ? "restore" : "hide"} />
                  <button className={`rounded-full border px-3 py-1 text-xs font-black ${hidden ? "border-emerald-300 text-emerald-800" : "border-slate-300 text-slate-800"}`} data-testid={`chat-${hidden ? "restore" : "hide"}-${message.id}`}>{hidden ? "Restore" : "Hide"}</button>
                </form>
                {message.attendeeId ? <SilenceForm eventId={eventId} roomKind={message.roomKind} roomId={message.roomId} attendeeId={message.attendeeId} silenced={silenced} compact /> : null}
                {message.attendeeId ? <code className="text-[11px] text-slate-400">{message.attendeeId}</code> : null}
              </div>
            </article>
          );
        }) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No chat messages yet for this event. Rows appear here as attendees post.</p>}
      </div>
    </section>
  );
}
