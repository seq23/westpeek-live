"use client";
import type { LiveChatRoomKind } from "@/types/liveChat";

/**
 * Clear chat, with the confirm that names the number. It ARCHIVES: every message in the room is
 * stamped archived_at and leaves every view — attendee and crew — but the rows stay for the audit
 * and any later export. Nothing is hard-deleted, and the confirm says so rather than implying a
 * wipe the schema never performs. "Cannot be undone" is still true from the room's side: there is
 * no un-clear control, and the crew should know that before they press it.
 */
export function ClearChatControl({ action, eventId, roomKind, roomId, roomLabel, messageCount, deniedReason }: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  roomKind: LiveChatRoomKind;
  roomId: string;
  roomLabel: string;
  messageCount: number;
  deniedReason?: string;
}) {
  const empty = messageCount === 0;
  const confirmText = `Clear ${messageCount} message${messageCount === 1 ? "" : "s"} from ${roomLabel}? Everyone in the room — attendees and crew — stops seeing them immediately. The rows are archived for the audit trail, not deleted, and there is no un-clear button: this cannot be undone from here.`;
  if (deniedReason) {
    return (
      <form className="inline" data-testid={`chat-clear-${roomKind}-${roomId}`} data-crew-denied="moderate_chat" title={deniedReason}>
        <fieldset disabled className="contents" title={deniedReason}><button className="rounded-full border border-rose-300 px-4 py-2 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-40">Clear chat</button></fieldset>
        <span className="sr-only">{deniedReason}</span>
      </form>
    );
  }
  return (
    <form action={action} className="inline" data-testid={`chat-clear-${roomKind}-${roomId}`} data-message-count={messageCount} onSubmit={(submit) => { if (!window.confirm(confirmText)) submit.preventDefault(); }}>
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} />
      <button disabled={empty} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-40" title={empty ? "Nothing to clear in this room." : confirmText}>Clear chat{empty ? "" : ` (${messageCount})`}</button>
    </form>
  );
}
