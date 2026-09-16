import { randomId } from "@/lib/security/portableCrypto";
import { refusePreviewWrite } from "@/lib/auth/previewIdentity";
import { selectNextSpeedNetworkingPair } from "@/services/speed-networking/speedNetworkingEngine";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type EventGuestStateRecord } from "@/types/specialGuest";
import type { SpeedNetworkingEntry, SpeedNetworkingPairHistory } from "@/types/speedNetworkingEngine";
import { SPEED_NETWORKING_DEFAULT_MINUTES, speedNetworkingRoomName, type SpeedNetworkingMatchRecord, type SpeedNetworkingQueueEntry, type SpeedNetworkingSettings } from "@/types/speedNetworking";

/**
 * Real speed networking. A queue per event; a matcher that runs on every read and pairs the two
 * longest-waiting compatible attendees through the existing pure engine (no repeats within the
 * event, from the match history); one LiveKit room per match, <eventId>-net-<matchId>, whose
 * token only the two matched attendees can get (see tokenAllowedForRoom); a crew-configurable
 * timer (default 4 minutes) after which both are returned to the queue automatically.
 */
function now() { return new Date().toISOString(); }

const DEFAULT_SETTINGS: Omit<SpeedNetworkingSettings, "updatedBy" | "updatedAt"> = { open: true, matchMinutes: SPEED_NETWORKING_DEFAULT_MINUTES };

export async function getNetworkingSettings(eventId: string): Promise<SpeedNetworkingSettings> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "networking_settings")).catch(() => undefined);
  const state = record?.state as Partial<SpeedNetworkingSettings> | undefined;
  return { open: state?.open ?? DEFAULT_SETTINGS.open, matchMinutes: clampMinutes(state?.matchMinutes), updatedBy: state?.updatedBy || "default", updatedAt: state?.updatedAt || "" };
}

export function clampMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return SPEED_NETWORKING_DEFAULT_MINUTES;
  return Math.min(30, Math.max(1, Math.round(minutes)));
}

export async function setNetworkingSettings(eventId: string, input: { open: boolean; matchMinutes: number }, updatedBy: string) {
  const state: SpeedNetworkingSettings = { open: input.open, matchMinutes: clampMinutes(input.matchMinutes), updatedBy, updatedAt: now() };
  const record: EventGuestStateRecord<SpeedNetworkingSettings> = { key: eventGuestStateKey(eventId, "networking_settings"), eventId, kind: "networking_settings", state, updatedAt: state.updatedAt };
  await getRuntimeStore().setEventGuestState(record);
  return state;
}

// ---- queue ---------------------------------------------------------------------------

export async function joinNetworkingQueue(eventId: string, attendee: { attendeeId: string; displayName: string; company?: string; title?: string }) {
  // Pairing is the loudest way a preview could reach a real person: they would be put in a room together.
  refusePreviewWrite(attendee.attendeeId, "join the networking queue");
  const store = getRuntimeStore();
  const existing = await store.getSpeedNetworkingEntry(eventId, attendee.attendeeId);
  if (existing?.status === "matched" || existing?.status === "waiting") return existing;
  const entry: SpeedNetworkingQueueEntry = {
    id: existing?.id || randomId("net-entry"),
    eventId,
    attendeeId: attendee.attendeeId,
    displayName: attendee.displayName,
    company: attendee.company || "",
    title: attendee.title || "",
    status: "waiting",
    joinedAt: now(),
    matchedAt: undefined,
    matchId: undefined,
    matchesCompleted: existing?.matchesCompleted || 0,
    updatedAt: now(),
  };
  await store.upsertSpeedNetworkingEntry(entry);
  return entry;
}

export async function leaveNetworkingQueue(eventId: string, attendeeId: string, reason = "left") {
  const store = getRuntimeStore();
  const entry = await store.getSpeedNetworkingEntry(eventId, attendeeId);
  if (!entry) return undefined;
  if (entry.matchId) await endMatch(eventId, entry.matchId, reason);
  const updated: SpeedNetworkingQueueEntry = { ...entry, status: "left", matchId: undefined, updatedAt: now() };
  await store.upsertSpeedNetworkingEntry(updated);
  return updated;
}

// ---- matches -------------------------------------------------------------------------

function toEngineEntry(entry: SpeedNetworkingQueueEntry): SpeedNetworkingEntry {
  return { id: entry.id, agencyId: "west-peek", eventId: entry.eventId, queueId: `${entry.eventId}-queue`, attendeeId: entry.attendeeId, displayName: entry.displayName, status: entry.status === "waiting" ? "waiting" : entry.status === "matched" ? "matched" : "left", joinedQueueAt: entry.joinedAt, lastMatchedAt: entry.matchedAt };
}

function toPairHistory(match: SpeedNetworkingMatchRecord): SpeedNetworkingPairHistory {
  return { eventId: match.eventId, normalizedPairKey: match.normalizedPairKey, attendeeAId: match.attendeeAId, attendeeBId: match.attendeeBId, firstMatchedAt: match.startsAt, matchId: match.id };
}

/** Ends one match and returns both attendees to the queue (waiting again, with the match counted). */
export async function endMatch(eventId: string, matchId: string, reason: string, options: { requeue?: boolean } = {}) {
  const store = getRuntimeStore();
  const match = await store.getSpeedNetworkingMatch(eventId, matchId);
  if (!match || match.status !== "active") return match;
  const ended: SpeedNetworkingMatchRecord = { ...match, status: reason === "expired" ? "expired" : "ended", endedAt: now(), endedReason: reason };
  await store.upsertSpeedNetworkingMatch(ended);
  for (const attendeeId of [match.attendeeAId, match.attendeeBId]) {
    const entry = await store.getSpeedNetworkingEntry(eventId, attendeeId);
    if (!entry || entry.matchId !== matchId) continue;
    const requeue = options.requeue ?? true;
    await store.upsertSpeedNetworkingEntry({ ...entry, status: requeue ? "waiting" : "done", matchId: undefined, joinedAt: requeue ? now() : entry.joinedAt, matchesCompleted: entry.matchesCompleted + 1, updatedAt: now() });
  }
  return ended;
}

/**
 * The matcher. Runs on every queue read: expires matches past their window (both attendees back
 * to waiting), then pairs the two longest-waiting compatible attendees, repeatedly, using the pure
 * engine and the event's match history so a pair never meets twice. Idempotent and cheap.
 */
export async function runNetworkingMatcher(eventId: string) {
  const store = getRuntimeStore();
  const settings = await getNetworkingSettings(eventId);
  const matches = await store.listSpeedNetworkingMatches(eventId);
  const nowMs = Date.now();
  for (const match of matches) {
    if (match.status === "active" && new Date(match.expiresAt).getTime() <= nowMs) await endMatch(eventId, match.id, "expired");
  }
  if (!settings.open) return { created: [] as SpeedNetworkingMatchRecord[], settings };
  const created: SpeedNetworkingMatchRecord[] = [];
  const history = (await store.listSpeedNetworkingMatches(eventId)).map(toPairHistory);
  // Loop until no compatible pair remains; each iteration re-reads the queue so status changes stick.
  for (let guard = 0; guard < 50; guard += 1) {
    const entries = await store.listSpeedNetworkingEntries(eventId);
    const pair = selectNextSpeedNetworkingPair(entries.map(toEngineEntry), [], history);
    if (!pair) break;
    const [first, second] = pair;
    const matchId = randomId("match");
    const startsAt = new Date();
    const match: SpeedNetworkingMatchRecord = {
      id: matchId,
      eventId,
      attendeeAId: first.attendeeId!,
      attendeeBId: second.attendeeId!,
      normalizedPairKey: `${eventId}::${[first.attendeeId!, second.attendeeId!].sort().join("::")}`,
      roomName: speedNetworkingRoomName(eventId, matchId),
      status: "active",
      startsAt: startsAt.toISOString(),
      expiresAt: new Date(startsAt.getTime() + settings.matchMinutes * 60_000).toISOString(),
    };
    await store.upsertSpeedNetworkingMatch(match);
    for (const attendeeId of [match.attendeeAId, match.attendeeBId]) {
      const entry = entries.find((item) => item.attendeeId === attendeeId)!;
      await store.upsertSpeedNetworkingEntry({ ...entry, status: "matched", matchId, matchedAt: match.startsAt, updatedAt: now() });
    }
    history.push(toPairHistory(match));
    created.push(match);
  }
  return { created, settings };
}

// ---- what one attendee sees ------------------------------------------------------------

export interface MyNetworkingState {
  status: "idle" | "waiting" | "matched" | "closed";
  queueSize: number;
  matchesInProgress: number;
  matchMinutes: number;
  open: boolean;
  match?: { id: string; roomName: string; partner: { attendeeId: string; name: string; company: string; title: string }; startsAt: string; expiresAt: string; secondsLeft: number };
}

export async function getMyNetworkingState(eventId: string, attendeeId: string | undefined): Promise<MyNetworkingState> {
  const { settings } = await runNetworkingMatcher(eventId);
  const store = getRuntimeStore();
  const entries = await store.listSpeedNetworkingEntries(eventId);
  const queueSize = entries.filter((entry) => entry.status === "waiting").length;
  const matchesInProgress = (await store.listSpeedNetworkingMatches(eventId)).filter((match) => match.status === "active").length;
  const base = { queueSize, matchesInProgress, matchMinutes: settings.matchMinutes, open: settings.open };
  if (!attendeeId) return { status: settings.open ? "idle" : "closed", ...base };
  const mine = entries.find((entry) => entry.attendeeId === attendeeId);
  if (!mine || mine.status === "left" || mine.status === "done") return { status: settings.open ? "idle" : "closed", ...base };
  if (mine.status === "matched" && mine.matchId) {
    const match = await store.getSpeedNetworkingMatch(eventId, mine.matchId);
    if (match && match.status === "active") {
      const partnerId = match.attendeeAId === attendeeId ? match.attendeeBId : match.attendeeAId;
      const partner = entries.find((entry) => entry.attendeeId === partnerId);
      return { status: "matched", ...base, match: { id: match.id, roomName: match.roomName, partner: { attendeeId: partnerId, name: partner?.displayName || "Your match", company: partner?.company || "", title: partner?.title || "" }, startsAt: match.startsAt, expiresAt: match.expiresAt, secondsLeft: Math.max(0, Math.round((new Date(match.expiresAt).getTime() - Date.now()) / 1000)) } };
    }
  }
  return { status: settings.open ? "waiting" : "closed", ...base };
}

/** "Next match": end the current one (both back to waiting) and keep this attendee waiting. */
export async function nextNetworkingMatch(eventId: string, attendeeId: string) {
  const entry = await getRuntimeStore().getSpeedNetworkingEntry(eventId, attendeeId);
  if (entry?.matchId) await endMatch(eventId, entry.matchId, "next");
  return getMyNetworkingState(eventId, attendeeId);
}

/** Pure: a token for a networking room goes only to one of the two attendees of that ACTIVE match. */
export function tokenAllowedForRoom(match: SpeedNetworkingMatchRecord | undefined, roomName: string, attendeeId: string) {
  if (!match || match.status !== "active") return false;
  if (match.roomName !== roomName) return false;
  if (new Date(match.expiresAt).getTime() <= Date.now()) return false;
  return match.attendeeAId === attendeeId || match.attendeeBId === attendeeId;
}

export async function findActiveMatchForRoom(eventId: string, roomName: string) {
  const matches = await getRuntimeStore().listSpeedNetworkingMatches(eventId);
  return matches.find((match) => match.roomName === roomName && match.status === "active");
}

export async function crewNetworkingSummary(eventId: string) {
  const { settings } = await runNetworkingMatcher(eventId);
  const store = getRuntimeStore();
  const entries = await store.listSpeedNetworkingEntries(eventId);
  const matches = await store.listSpeedNetworkingMatches(eventId);
  return { settings, queueSize: entries.filter((entry) => entry.status === "waiting").length, matchesInProgress: matches.filter((match) => match.status === "active").length, matchesTotal: matches.length, waiting: entries.filter((entry) => entry.status === "waiting"), active: matches.filter((match) => match.status === "active").map((match) => ({ ...match, a: entries.find((entry) => entry.attendeeId === match.attendeeAId)?.displayName || match.attendeeAId, b: entries.find((entry) => entry.attendeeId === match.attendeeBId)?.displayName || match.attendeeBId })) };
}
