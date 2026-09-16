import { randomId } from "@/lib/security/portableCrypto";
import { planSpeedNetworkingRound, selectSpeedNetworkingTier, type SpeedNetworkingCandidate, type SpeedNetworkingTier } from "@/services/speed-networking/speedNetworkingTiers";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { deleteLiveKitRoom } from "@/services/video/livekitRoomAdmin";
import { findEventRecord } from "@/services/events/eventRepository";
import { eventGuestStateKey, type EventGuestStateRecord } from "@/types/specialGuest";
import type { SpeedNetworkingPairHistory } from "@/types/speedNetworkingEngine";
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

/**
 * A finished event has no queue. The crew's open/closed switch is the normal control, but the
 * event's own status overrules it: an event that has ended, moved to replay, or been archived is
 * closed for networking whatever the stored setting says (16 Sep 2026 — an ended event still
 * advertised "Networking OPEN" in the venue nav and would still take queue joins).
 */
export function networkingClosedByEventStatus(status: string | undefined) {
  return status === "ended" || status === "replay_available" || status === "archived";
}

export async function getNetworkingSettings(eventId: string): Promise<SpeedNetworkingSettings> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "networking_settings")).catch(() => undefined);
  const state = record?.state as Partial<SpeedNetworkingSettings> | undefined;
  const event = await findEventRecord(eventId).catch(() => undefined);
  const eventIsOver = networkingClosedByEventStatus(event?.status);
  return { open: eventIsOver ? false : state?.open ?? DEFAULT_SETTINGS.open, matchMinutes: clampMinutes(state?.matchMinutes), updatedBy: eventIsOver ? "event_ended" : state?.updatedBy || "default", updatedAt: state?.updatedAt || "" };
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

/**
 * What the last round left behind: who was the odd one out (they lead the next round and are told
 * "you are next"), who has met everyone here, and who has said they would rather meet somebody
 * again than keep waiting. Kept in the event guest-state row, so no new table.
 */
export interface SpeedNetworkingRoundState {
  priorityAttendeeIds: string[];
  metEveryoneAttendeeIds: string[];
  repeatOptInAttendeeIds: string[];
  lastTier: SpeedNetworkingTier;
  lastRoundAt: string;
}

const EMPTY_ROUND_STATE: SpeedNetworkingRoundState = { priorityAttendeeIds: [], metEveryoneAttendeeIds: [], repeatOptInAttendeeIds: [], lastTier: "fifo", lastRoundAt: "" };

export async function getNetworkingRoundState(eventId: string): Promise<SpeedNetworkingRoundState> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "networking_round_state")).catch(() => undefined);
  const state = record?.state as Partial<SpeedNetworkingRoundState> | undefined;
  return {
    priorityAttendeeIds: state?.priorityAttendeeIds || [],
    metEveryoneAttendeeIds: state?.metEveryoneAttendeeIds || [],
    repeatOptInAttendeeIds: state?.repeatOptInAttendeeIds || [],
    lastTier: state?.lastTier || EMPTY_ROUND_STATE.lastTier,
    lastRoundAt: state?.lastRoundAt || "",
  };
}

async function setNetworkingRoundState(eventId: string, state: SpeedNetworkingRoundState) {
  const record: EventGuestStateRecord<SpeedNetworkingRoundState> = { key: eventGuestStateKey(eventId, "networking_round_state"), eventId, kind: "networking_round_state", state, updatedAt: state.lastRoundAt || now() };
  await getRuntimeStore().setEventGuestState(record);
  return state;
}

/** "Meet someone again": the only way out of a queue that has nobody new left in it. */
export async function allowRepeatNetworkingMatch(eventId: string, attendeeId: string) {
  const state = await getNetworkingRoundState(eventId);
  if (!state.repeatOptInAttendeeIds.includes(attendeeId)) state.repeatOptInAttendeeIds = [...state.repeatOptInAttendeeIds, attendeeId];
  await setNetworkingRoundState(eventId, { ...state, lastRoundAt: now() });
  return getMyNetworkingState(eventId, attendeeId);
}

// ---- queue ---------------------------------------------------------------------------

export async function joinNetworkingQueue(eventId: string, attendee: { attendeeId: string; displayName: string; company?: string; title?: string }) {
  const store = getRuntimeStore();
  // Closed is closed: an ended event, or a crew that has switched networking off, takes no joins.
  const settings = await getNetworkingSettings(eventId);
  if (!settings.open) return undefined;
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

function toPairHistory(match: SpeedNetworkingMatchRecord): SpeedNetworkingPairHistory {
  return { eventId: match.eventId, normalizedPairKey: match.normalizedPairKey, attendeeAId: match.attendeeAId, attendeeBId: match.attendeeBId, firstMatchedAt: match.startsAt, matchId: match.id };
}

/**
 * Match over: delete the LiveKit room outright. Removing participants one at a time races a client
 * that is still reconnecting; deleting the room disconnects everyone, so the next match — or a
 * rejoin into a room of the same name — starts empty instead of inheriting the last call's ghosts.
 * Best effort on purpose: the match must still end when LiveKit is unreachable or unconfigured.
 */
export async function purgeSpeedNetworkingRoom(roomName: string) {
  const deleted = await deleteLiveKitRoom(roomName).catch(() => ({ configured: false as const }));
  return { roomName, cleaned: deleted.configured && deleted.deleted };
}

/** Ends one match and returns both attendees to the queue (waiting again, with the match counted). */
export async function endMatch(eventId: string, matchId: string, reason: string, options: { requeue?: boolean } = {}) {
  const store = getRuntimeStore();
  const match = await store.getSpeedNetworkingMatch(eventId, matchId);
  if (!match || match.status !== "active") return match;
  const ended: SpeedNetworkingMatchRecord = { ...match, status: reason === "expired" ? "expired" : "ended", endedAt: now(), endedReason: reason };
  await store.upsertSpeedNetworkingMatch(ended);
  await purgeSpeedNetworkingRoom(match.roomName);
  for (const attendeeId of [match.attendeeAId, match.attendeeBId]) {
    const entry = await store.getSpeedNetworkingEntry(eventId, attendeeId);
    if (!entry || entry.matchId !== matchId) continue;
    const requeue = options.requeue ?? true;
    await store.upsertSpeedNetworkingEntry({ ...entry, status: requeue ? "waiting" : "done", matchId: undefined, joinedAt: requeue ? now() : entry.joinedAt, matchesCompleted: entry.matchesCompleted + 1, updatedAt: now() });
  }
  return ended;
}

/**
 * The waiting queue as the tiered matcher sees it: the queue row plus whatever the attendee's own
 * profile says about what they came for. Profiles are read at match time rather than copied onto
 * the queue row, so an attendee who fills in their topics mid-event is scored on the new answer.
 */
async function buildRoundCandidates(eventId: string, entries: SpeedNetworkingQueueEntry[], priorityAttendeeIds: string[]): Promise<SpeedNetworkingCandidate[]> {
  const waiting = entries.filter((entry) => entry.status === "waiting");
  if (!waiting.length) return [];
  const profiles = await getRuntimeStore().listAttendeeProfiles(eventId).catch(() => []);
  const byAttendee = new Map(profiles.map((profile) => [profile.attendeeId, profile]));
  return waiting.map((entry) => {
    const profile = byAttendee.get(entry.attendeeId);
    return {
      attendeeId: entry.attendeeId,
      displayName: entry.displayName,
      company: entry.company || profile?.company,
      title: entry.title || profile?.title,
      topicsOfInterest: profile?.topicsOfInterest || [],
      networkingGoals: profile?.networkingGoals,
      joinedAt: entry.joinedAt,
      priority: priorityAttendeeIds.includes(entry.attendeeId),
    };
  });
}

/**
 * The matcher. Runs on every queue read: expires matches past their window (both attendees back to
 * waiting), then forms the whole next round in ONE batch tick — not pair by pair as people poll,
 * so whoever refreshes first does not take the best partner. How the pairs are chosen depends on
 * how many are waiting (see SPEED_NETWORKING_MATCHING_CONFIG): longest-waiting first for a small
 * room, weighted random inside the longest-waiting half for a medium one, scored on shared topics,
 * complementary goals, different companies and a wait time that eventually outweighs all of it for
 * a large one. A pair still never meets twice. Idempotent and cheap.
 */
export async function runNetworkingMatcher(eventId: string, options: { random?: () => number } = {}) {
  const store = getRuntimeStore();
  const settings = await getNetworkingSettings(eventId);
  const matches = await store.listSpeedNetworkingMatches(eventId);
  const nowMs = Date.now();
  for (const match of matches) {
    if (match.status === "active" && new Date(match.expiresAt).getTime() <= nowMs) await endMatch(eventId, match.id, "expired");
  }
  const roundState = await getNetworkingRoundState(eventId);
  if (!settings.open) return { created: [] as SpeedNetworkingMatchRecord[], settings, roundState };
  const history = (await store.listSpeedNetworkingMatches(eventId)).map(toPairHistory);
  const entries = await store.listSpeedNetworkingEntries(eventId);
  const candidates = await buildRoundCandidates(eventId, entries, roundState.priorityAttendeeIds);
  const plan = planSpeedNetworkingRound({ eventId, waiting: candidates, pairHistory: history, repeatOptIn: roundState.repeatOptInAttendeeIds, nowMs, random: options.random });

  const created: SpeedNetworkingMatchRecord[] = [];
  for (const pair of plan.pairs) {
    const matchId = randomId("match");
    const startsAt = new Date();
    const match: SpeedNetworkingMatchRecord = {
      id: matchId,
      eventId,
      attendeeAId: pair.first.attendeeId,
      attendeeBId: pair.second.attendeeId,
      normalizedPairKey: `${eventId}::${[pair.first.attendeeId, pair.second.attendeeId].sort().join("::")}`,
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
    created.push(match);
  }

  // The odd one out leads the next round, and a repeat opt-in is spent once it has been honoured.
  const stillNeedsARepeat = roundState.repeatOptInAttendeeIds.filter((attendeeId) => !created.some((match) => match.attendeeAId === attendeeId || match.attendeeBId === attendeeId));
  const nextRoundState: SpeedNetworkingRoundState = {
    priorityAttendeeIds: plan.oddOneOut ? [plan.oddOneOut.attendeeId] : [],
    metEveryoneAttendeeIds: plan.metEveryone.map((candidate) => candidate.attendeeId),
    repeatOptInAttendeeIds: stillNeedsARepeat,
    lastTier: plan.tier,
    lastRoundAt: now(),
  };
  await setNetworkingRoundState(eventId, nextRoundState);
  return { created, settings, roundState: nextRoundState, plan };
}

// ---- what one attendee sees ------------------------------------------------------------

export interface MyNetworkingState {
  status: "idle" | "waiting" | "matched" | "closed";
  queueSize: number;
  matchesInProgress: number;
  matchMinutes: number;
  open: boolean;
  /** How this event is currently matching — it changes with the size of the queue. */
  tier: SpeedNetworkingTier;
  /** Left over from the last round: first in line next time, and told so rather than left guessing. */
  nextUp: boolean;
  /** Nobody new left in the queue for this attendee; waiting alone will never resolve. */
  metEveryone: boolean;
  /** They have asked to be paired with someone they already met. */
  repeatRequested: boolean;
  match?: { id: string; roomName: string; partner: { attendeeId: string; name: string; company: string; title: string }; startsAt: string; expiresAt: string; secondsLeft: number };
}

export async function getMyNetworkingState(eventId: string, attendeeId: string | undefined): Promise<MyNetworkingState> {
  const { settings, roundState } = await runNetworkingMatcher(eventId);
  const store = getRuntimeStore();
  const entries = await store.listSpeedNetworkingEntries(eventId);
  const queueSize = entries.filter((entry) => entry.status === "waiting").length;
  const matchesInProgress = (await store.listSpeedNetworkingMatches(eventId)).filter((match) => match.status === "active").length;
  const base = {
    queueSize,
    matchesInProgress,
    matchMinutes: settings.matchMinutes,
    open: settings.open,
    tier: roundState.lastTier,
    nextUp: Boolean(attendeeId && roundState.priorityAttendeeIds.includes(attendeeId)),
    metEveryone: Boolean(attendeeId && roundState.metEveryoneAttendeeIds.includes(attendeeId)),
    repeatRequested: Boolean(attendeeId && roundState.repeatOptInAttendeeIds.includes(attendeeId)),
  };
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
  const { settings, roundState } = await runNetworkingMatcher(eventId);
  const store = getRuntimeStore();
  const entries = await store.listSpeedNetworkingEntries(eventId);
  const matches = await store.listSpeedNetworkingMatches(eventId);
  return { settings, tier: roundState.lastTier, nextUpAttendeeIds: roundState.priorityAttendeeIds, metEveryoneAttendeeIds: roundState.metEveryoneAttendeeIds, queueSize: entries.filter((entry) => entry.status === "waiting").length, matchesInProgress: matches.filter((match) => match.status === "active").length, matchesTotal: matches.length, waiting: entries.filter((entry) => entry.status === "waiting"), active: matches.filter((match) => match.status === "active").map((match) => ({ ...match, a: entries.find((entry) => entry.attendeeId === match.attendeeAId)?.displayName || match.attendeeAId, b: entries.find((entry) => entry.attendeeId === match.attendeeBId)?.displayName || match.attendeeBId })) };
}

/**
 * The show is over: close networking and empty the queue. Every active match is ended (which
 * deletes its LiveKit room), everyone waiting or matched is marked done, and the crew's switch is
 * left off — so the venue nav has no "OPEN" to render and a late arrival cannot join a queue that
 * nobody is watching. Idempotent; safe to call on an event that was already closed.
 */
export async function closeNetworkingForEndedEvent(eventId: string, closedBy = "show_ended") {
  const store = getRuntimeStore();
  // Everyone in the queue is read before anything is ended, so the count is people taken out of the
  // queue rather than whatever survived ending the matches.
  const inQueue = (await store.listSpeedNetworkingEntries(eventId).catch(() => [])).filter((entry) => entry.status === "waiting" || entry.status === "matched");
  const matches = await store.listSpeedNetworkingMatches(eventId).catch(() => []);
  const matchesEnded = matches.filter((match) => match.status === "active").length;
  for (const match of matches) {
    if (match.status === "active") await endMatch(eventId, match.id, "event_ended", { requeue: false });
  }
  for (const stale of inQueue) {
    const entry = (await store.getSpeedNetworkingEntry(eventId, stale.attendeeId)) || stale;
    if (entry.status === "done" || entry.status === "left") continue;
    await store.upsertSpeedNetworkingEntry({ ...entry, status: "done", matchId: undefined, updatedAt: now() });
  }
  const cleared = inQueue.length;
  await setNetworkingSettings(eventId, { open: false, matchMinutes: (await getNetworkingSettings(eventId)).matchMinutes }, closedBy);
  await setNetworkingRoundState(eventId, { priorityAttendeeIds: [], metEveryoneAttendeeIds: [], repeatOptInAttendeeIds: [], lastTier: "fifo", lastRoundAt: now() });
  return { cleared, matchesEnded };
}
