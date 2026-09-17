import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { parseGoogleMeetUrl, parseZoomMeetingNumber, parseZoomPasscode, type EventBackupRoomRecord } from "@/types/backupRoom";

/**
 * The Zoom meeting and the Google Meet room for ONE event, saved by a person.
 *
 * Both rungs used to come out of Worker variables, which meant the only way to set up the bottom of
 * the ladder was a deploy. This is the read and the write behind the crew deck's Backup rooms card.
 *
 * The environment variables are still honoured as the HOUSE room: a deployment that has always had
 * a standing Zoom bridge or a permanent Meet room keeps it, and an event that saves its own takes
 * precedence over it. Nothing else in the app reads those variables any more.
 */
export function houseZoomMeetingNumber() {
  return (process.env.TIER4_ZOOM_MEETING_NUMBER || process.env.ZOOM_MEETING_NUMBER || "").trim() || undefined;
}

export function houseGoogleMeetUrl() {
  return (process.env.GOOGLE_MEET_MANAGED_FALLBACK_URL || process.env.GOOGLE_MEET_EMERGENCY_URL || "").trim() || undefined;
}

/**
 * What this event's bottom two rungs actually are, the event's own row winning over the house room.
 * Always returns a record, so a caller never has to decide what "no row yet" means.
 */
export async function getEventBackupRoom(eventId: string, stageId = "main-stage"): Promise<EventBackupRoomRecord> {
  const stored = await getRuntimeStore().getEventBackupRoom(eventId, stageId).catch(() => undefined);
  // The passcode travels with the meeting it belongs to: the house Zoom bridge has never had one,
  // so pairing this event's passcode with the house number would just fail to join.
  const eventHasOwnZoom = Boolean(stored?.zoomMeetingNumber);
  return {
    eventId,
    stageId,
    zoomMeetingNumber: eventHasOwnZoom ? stored?.zoomMeetingNumber : houseZoomMeetingNumber(),
    zoomPasscode: eventHasOwnZoom ? stored?.zoomPasscode : undefined,
    googleMeetUrl: stored?.googleMeetUrl || houseGoogleMeetUrl(),
    updatedBy: stored?.updatedBy,
    updatedAt: stored?.updatedAt || "",
  };
}

export interface SaveBackupRoomInput {
  eventId: string;
  stageId?: string;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
  googleMeetUrl?: string;
  /** The role that pressed Save: "owner", "operator", "crew:producer". Never a person's name. */
  savedBy: string;
}

export interface SaveBackupRoomResult {
  ok: boolean;
  /** Which field was refused and why, in the sentence the card shows. */
  reason?: string;
  record?: EventBackupRoomRecord;
}

/**
 * Save both fields, or save neither.
 *
 * Each value is validated and the FIRST thing wrong with it is returned as a sentence naming the
 * field, because this is typed on show day under pressure and "invalid input" would cost a minute
 * nobody has. Clearing a field is allowed and is how a rung is taken back out of service.
 */
export async function saveEventBackupRoom(input: SaveBackupRoomInput): Promise<SaveBackupRoomResult> {
  const stageId = input.stageId || "main-stage";
  const zoom = parseZoomMeetingNumber(input.zoomMeetingNumber);
  if (!zoom.ok) return { ok: false, reason: `Zoom meeting number: ${zoom.reason}` };
  const passcode = parseZoomPasscode(input.zoomPasscode);
  if (!passcode.ok) return { ok: false, reason: `Zoom passcode: ${passcode.reason}` };
  const meet = parseGoogleMeetUrl(input.googleMeetUrl);
  if (!meet.ok) return { ok: false, reason: `Google Meet link: ${meet.reason}` };
  // A passcode with no meeting is not a configured rung; keeping it would make the card look set up.
  const record: EventBackupRoomRecord = {
    eventId: input.eventId,
    stageId,
    zoomMeetingNumber: zoom.value,
    zoomPasscode: zoom.value ? passcode.value : undefined,
    googleMeetUrl: meet.value,
    updatedBy: input.savedBy,
    updatedAt: new Date().toISOString(),
  };
  await getRuntimeStore().setEventBackupRoom(record);
  return { ok: true, record };
}
