import { randomId } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type CueCard, type CueDeckVersion, type EventGuestStateKind, type EventGuestStateRecord, type ProducerNotesState, type SpeakerCueDeckState, type SpeakerLiveCueState, type SpeakerStageState, type SpeakerTechCheckState, type SponsorBoothState, type VipRoomState, VIP_ROOM_ID } from "@/types/specialGuest";

function now() {
  return new Date().toISOString();
}

async function getState<T>(eventId: string, kind: EventGuestStateKind, guestId?: string): Promise<T | undefined> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, kind, guestId)).catch(() => undefined);
  return record?.state as T | undefined;
}

async function setState<T>(eventId: string, kind: EventGuestStateKind, state: T, guestId?: string): Promise<T> {
  const record: EventGuestStateRecord<T> = { key: eventGuestStateKey(eventId, kind, guestId), eventId, kind, guestId, state, updatedAt: now() };
  await getRuntimeStore().setEventGuestState(record);
  return state;
}

async function listStates<T>(eventId: string, kind: EventGuestStateKind) {
  const records = await getRuntimeStore().listEventGuestStates(eventId, kind).catch(() => [] as EventGuestStateRecord[]);
  return records.map((record) => ({ guestId: record.guestId, state: record.state as T, updatedAt: record.updatedAt }));
}

// ---- speaker stage ---------------------------------------------------------

export const BACKSTAGE: SpeakerStageState = { status: "backstage", updatedBy: "system", updatedAt: "1970-01-01T00:00:00.000Z" };

export async function getSpeakerStageState(eventId: string, speakerId: string) {
  return (await getState<SpeakerStageState>(eventId, "speaker_stage", speakerId)) || BACKSTAGE;
}

/** Crew: the speaker may publish on the main stage; their green room shows "Go on stage". */
export async function bringSpeakerToStage(eventId: string, speakerId: string, actorRole: string) {
  return setState<SpeakerStageState>(eventId, "speaker_stage", { status: "invited", updatedBy: actorRole, updatedAt: now(), invitedAt: now() }, speakerId);
}

/** Speaker: pressed "Go on stage" (the grant must already be invited or on_stage). */
export async function markSpeakerOnStage(eventId: string, speakerId: string) {
  const current = await getSpeakerStageState(eventId, speakerId);
  if (current.status === "backstage") return current;
  return setState<SpeakerStageState>(eventId, "speaker_stage", { ...current, status: "on_stage", wentOnStageAt: now(), updatedAt: now() }, speakerId);
}

/** Crew: revoke the stage grant; the speaker returns to the green room. */
export async function sendSpeakerBackstage(eventId: string, speakerId: string, actorRole: string) {
  return setState<SpeakerStageState>(eventId, "speaker_stage", { status: "backstage", updatedBy: actorRole, updatedAt: now() }, speakerId);
}

export async function listSpeakerStageStates(eventId: string) {
  return listStates<SpeakerStageState>(eventId, "speaker_stage");
}

// ---- tech check ------------------------------------------------------------

export async function getSpeakerTechCheck(eventId: string, speakerId: string) {
  return getState<SpeakerTechCheckState>(eventId, "speaker_tech_check", speakerId);
}

export async function recordSpeakerTechCheck(eventId: string, speakerId: string, input: { status: SpeakerTechCheckState["status"]; score: number; checks: SpeakerTechCheckState["checks"] }) {
  return setState<SpeakerTechCheckState>(eventId, "speaker_tech_check", { status: input.status, score: Math.max(0, Math.min(100, Math.round(input.score))), checks: input.checks.slice(0, 20), recordedAt: now() }, speakerId);
}

export async function listSpeakerTechChecks(eventId: string) {
  return listStates<SpeakerTechCheckState>(eventId, "speaker_tech_check");
}

// ---- cue deck --------------------------------------------------------------

const EMPTY_DECK: SpeakerCueDeckState = { nextVersionNumber: 1 };

export async function getSpeakerCueDeck(eventId: string, speakerId: string): Promise<SpeakerCueDeckState> {
  return (await getState<SpeakerCueDeckState>(eventId, "speaker_cue_deck", speakerId)) || EMPTY_DECK;
}

export interface CueDeckInput {
  cards: Array<Pick<CueCard, "title" | "body">>;
  talkingPoints: string[];
  script?: string;
}

function cleanDeck(input: CueDeckInput) {
  const cards = input.cards.map((card) => ({ id: randomId("card"), title: card.title.trim().slice(0, 120), body: card.body.trim().slice(0, 2000) })).filter((card) => card.title || card.body).slice(0, 60);
  const talkingPoints = input.talkingPoints.map((point) => point.trim().slice(0, 300)).filter(Boolean).slice(0, 60);
  const script = input.script?.trim().slice(0, 20000) || undefined;
  return { cards, talkingPoints, script };
}

/**
 * Pure: the next deck state for a submission. Producer submissions are approved on save (they
 * are the approval); speaker submissions land as the pending version until the crew approves.
 * Exported so the ordering is unit-testable without a store.
 */
export function submitCueDeckVersion(current: SpeakerCueDeckState, input: CueDeckInput & { author: "producer" | "speaker"; authorLabel: string }): SpeakerCueDeckState {
  const { cards, talkingPoints, script } = cleanDeck(input);
  const version: CueDeckVersion = { id: randomId("deck"), versionNumber: current.nextVersionNumber, cards, talkingPoints, script, author: input.author, authorLabel: input.authorLabel, status: input.author === "producer" ? "approved" : "pending", submittedAt: now(), approvedAt: input.author === "producer" ? now() : undefined, approvedBy: input.author === "producer" ? input.authorLabel : undefined };
  if (input.author === "producer") return { approved: version, pending: current.pending, nextVersionNumber: current.nextVersionNumber + 1 };
  return { approved: current.approved, pending: version, nextVersionNumber: current.nextVersionNumber + 1 };
}

/** Pure: the crew approves the pending version; it becomes the approved one. */
export function approvePendingCueDeck(current: SpeakerCueDeckState, approvedBy: string): SpeakerCueDeckState {
  if (!current.pending) return current;
  return { approved: { ...current.pending, status: "approved", approvedAt: now(), approvedBy }, pending: undefined, nextVersionNumber: current.nextVersionNumber };
}

/** Pure: the crew discards the pending version; the approved one stands. */
export function discardPendingCueDeck(current: SpeakerCueDeckState): SpeakerCueDeckState {
  return { ...current, pending: undefined };
}

export async function saveCueDeckVersion(eventId: string, speakerId: string, input: CueDeckInput & { author: "producer" | "speaker"; authorLabel: string }) {
  const current = await getSpeakerCueDeck(eventId, speakerId);
  return setState<SpeakerCueDeckState>(eventId, "speaker_cue_deck", submitCueDeckVersion(current, input), speakerId);
}

export async function approveCueDeck(eventId: string, speakerId: string, approvedBy: string) {
  const current = await getSpeakerCueDeck(eventId, speakerId);
  return setState<SpeakerCueDeckState>(eventId, "speaker_cue_deck", approvePendingCueDeck(current, approvedBy), speakerId);
}

export async function discardCueDeck(eventId: string, speakerId: string) {
  const current = await getSpeakerCueDeck(eventId, speakerId);
  return setState<SpeakerCueDeckState>(eventId, "speaker_cue_deck", discardPendingCueDeck(current), speakerId);
}

export async function listSpeakerCueDecks(eventId: string) {
  return listStates<SpeakerCueDeckState>(eventId, "speaker_cue_deck");
}

/** "Title | body" per line, or "Title" alone. Blank lines are ignored. */
export function parseCueCardLines(text: string): Array<Pick<CueCard, "title" | "body">> {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("|");
    if (separator < 0) return { title: line, body: "" };
    return { title: line.slice(0, separator).trim(), body: line.slice(separator + 1).trim() };
  });
}

export function parseLines(text: string) {
  return text.split(/\r?\n/).map((line) => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
}

// ---- live cue --------------------------------------------------------------

export async function getSpeakerLiveCue(eventId: string, speakerId: string) {
  return getState<SpeakerLiveCueState>(eventId, "speaker_live_cue", speakerId);
}

export async function pushSpeakerLiveCue(eventId: string, speakerId: string, text: string, pushedBy: string) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return setState<SpeakerLiveCueState>(eventId, "speaker_live_cue", { text: clean, pushedBy, pushedAt: now() }, speakerId);
}

export async function clearSpeakerLiveCue(eventId: string, speakerId: string, pushedBy: string) {
  return setState<SpeakerLiveCueState>(eventId, "speaker_live_cue", { text: "", pushedBy, pushedAt: now() }, speakerId);
}

// ---- producer notes to speakers (event-level) ------------------------------

export async function getProducerNotes(eventId: string) {
  return getState<ProducerNotesState>(eventId, "producer_notes");
}

export async function saveProducerNotes(eventId: string, text: string, updatedBy: string) {
  return setState<ProducerNotesState>(eventId, "producer_notes", { text: text.trim().slice(0, 4000), updatedBy, updatedAt: now() });
}

// ---- sponsor booth -----------------------------------------------------------

export async function getSponsorBooth(eventId: string, sponsorId: string) {
  return getState<SponsorBoothState>(eventId, "sponsor_booth", sponsorId);
}

export async function saveSponsorBooth(eventId: string, sponsorId: string, input: { boothName: string; blurb: string; link: string }) {
  const boothName = input.boothName.replace(/\s+/g, " ").trim().slice(0, 120);
  const link = input.link.trim().slice(0, 500);
  const safeLink = /^https?:\/\//i.test(link) ? link : "";
  return setState<SponsorBoothState>(eventId, "sponsor_booth", { boothName, blurb: input.blurb.trim().slice(0, 1000), link: safeLink, published: Boolean(boothName), updatedAt: now() }, sponsorId);
}

export async function listSponsorBooths(eventId: string) {
  return (await listStates<SponsorBoothState>(eventId, "sponsor_booth")).filter((item) => item.state.published && item.guestId);
}

// ---- vip room --------------------------------------------------------------

export async function getVipRoom(eventId: string): Promise<VipRoomState> {
  return (await getState<VipRoomState>(eventId, "vip_room")) || { open: false, roomId: VIP_ROOM_ID, label: "VIP lounge", updatedBy: "system", updatedAt: "1970-01-01T00:00:00.000Z" };
}

export async function setVipRoomOpen(eventId: string, open: boolean, updatedBy: string) {
  const current = await getVipRoom(eventId);
  return setState<VipRoomState>(eventId, "vip_room", { ...current, open, updatedBy, updatedAt: now() });
}
