"use server";
import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { createAuditLog, type AuditAction } from "@/services/audit";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { liveChatRoomPath, postLiveRoomChatMessage, setLiveChatAttendeeSilence, setLiveChatMessageVisibility, setLiveChatRoomLock } from "@/services/venue/liveChatService";
import type { LiveChatRoomKind } from "@/types/liveChat";

function roomKindOf(value: FormDataEntryValue | null): LiveChatRoomKind {
  return value === "breakout" || value === "session" ? value : "main_stage";
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

/** Every surface that renders chat or the moderation queue for this event. */
function revalidateChatSurfaces(eventId: string, roomKind: LiveChatRoomKind, roomId: string) {
  revalidatePath(liveChatRoomPath(eventId, roomKind, roomId));
  revalidatePath(`/venue/${eventId}/stage`);
  revalidatePath(`/venue/${eventId}/breakouts`);
  revalidatePath(`/admin/testing/${eventId}`);
  revalidatePath(`/crew/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}`);
}

/** Attendee write path. Silence and lock are enforced in the service, not here. */
export async function sendLiveRoomChatMessage(formData: FormData) {
  const eventId = field(formData, "eventId");
  const roomKind = roomKindOf(formData.get("roomKind"));
  const roomId = field(formData, "roomId");
  const message = field(formData, "message");
  if (!eventId || !roomId || !message) return;
  const identity = await getCurrentAttendeeIdentity(eventId);
  if (!identity) return;
  await postLiveRoomChatMessage({ eventId, roomKind, roomId, attendeeId: identity.attendeeId, displayName: identity.displayName, company: identity.company, message });
  // Accepted or rejected, the room re-renders with the truth: the new message, or the
  // "silenced" / "locked" notice in place of the input.
  revalidateChatSurfaces(eventId, roomKind, roomId);
}

/** Crew, operator, or owner only. The guard throws for attendees and anonymous callers. */
async function requireControl(eventId: string) {
  const auth = await requireLiveEventControlAccessForRequest(eventId);
  if (!auth.ok) throw new Error(auth.error);
  return auth;
}

async function recordChatModeration(input: { eventId: string; actorRole: string; action: AuditAction; resourceType: string; resourceId: string }) {
  await createAuditLog({ agencyId: "west-peek", eventId: input.eventId, actorUserId: input.actorRole, actorRole: input.actorRole, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId, visibility: "internal_agency" }).catch(() => undefined);
}

/** action=hide | restore on one message. */
export async function moderateLiveChatMessage(formData: FormData) {
  const eventId = field(formData, "eventId");
  const messageId = field(formData, "messageId");
  const roomKind = roomKindOf(formData.get("roomKind"));
  const roomId = field(formData, "roomId") || "main-stage";
  const hidden = field(formData, "action") !== "restore";
  if (!eventId || !messageId) return;
  const auth = await requireControl(eventId);
  await setLiveChatMessageVisibility({ eventId, messageId, hidden, actorRole: auth.actorRole });
  await recordChatModeration({ eventId, actorRole: auth.actorRole, action: hidden ? "chat_message_hidden" : "chat_message_restored", resourceType: "live_chat_message", resourceId: messageId });
  revalidateChatSurfaces(eventId, roomKind, roomId);
}

/** silenced=true | false for one attendee in one room. */
export async function silenceLiveChatAttendee(formData: FormData) {
  const eventId = field(formData, "eventId");
  const attendeeId = field(formData, "attendeeId");
  const roomKind = roomKindOf(formData.get("roomKind"));
  const roomId = field(formData, "roomId") || "main-stage";
  const silenced = bool(formData.get("silenced"));
  const reason = field(formData, "reason") || undefined;
  if (!eventId || !attendeeId) return;
  const auth = await requireControl(eventId);
  await setLiveChatAttendeeSilence({ eventId, roomKind, roomId, attendeeId, silenced, actorRole: auth.actorRole, reason });
  await recordChatModeration({ eventId, actorRole: auth.actorRole, action: silenced ? "chat_attendee_silenced" : "chat_attendee_unsilenced", resourceType: "attendee", resourceId: attendeeId });
  revalidateChatSurfaces(eventId, roomKind, roomId);
}

/** locked=true | false for one room. */
export async function lockLiveChatRoom(formData: FormData) {
  const eventId = field(formData, "eventId");
  const roomKind = roomKindOf(formData.get("roomKind"));
  const roomId = field(formData, "roomId") || "main-stage";
  const locked = bool(formData.get("locked"));
  const reason = field(formData, "reason") || undefined;
  if (!eventId) return;
  const auth = await requireControl(eventId);
  await setLiveChatRoomLock({ eventId, roomKind, roomId, locked, actorRole: auth.actorRole, reason });
  await recordChatModeration({ eventId, actorRole: auth.actorRole, action: locked ? "chat_room_locked" : "chat_room_unlocked", resourceType: "live_chat_room", resourceId: `${roomKind}/${roomId}` });
  revalidateChatSurfaces(eventId, roomKind, roomId);
}
