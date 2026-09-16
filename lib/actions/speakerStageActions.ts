"use server";
import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { approveCueDeck, bringSpeakerToStage, clearSpeakerLiveCue, discardCueDeck, parseCueCardLines, parseLines, pushSpeakerLiveCue, saveCueDeckVersion, saveProducerNotes, sendSpeakerBackstage, setVipRoomOpen } from "@/services/guests/guestStateService";
import { removeLiveKitParticipantFromMainStage } from "@/services/video/livekitParticipantAdmin";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Owner, operator, or event-scoped crew. Speakers, sponsors, attendees, and anonymous callers are refused. */
async function requireControl(eventId: string) {
  const auth = await requireLiveEventControlAccessForRequest(eventId);
  if (!auth.ok) throw new Error(auth.error);
  return auth;
}

function revalidateSpeakerSurfaces(eventId: string) {
  for (const path of [`/crew/events/${eventId}`, `/app/events/${eventId}`, `/admin/testing/${eventId}`, `/speaker/events/${eventId}`, `/speaker/events/${eventId}/green-room`, `/speaker/events/${eventId}/teleprompter`, `/speaker/events/${eventId}/backstage`, `/venue/${eventId}/lobby`]) revalidatePath(path);
}

/** Bring to stage: the speaker gets a main-stage publish grant and sees "Go on stage". */
export async function bringSpeakerToStageAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const speakerId = field(formData, "speakerId");
  if (!eventId || !speakerId) return;
  const auth = await requireControl(eventId);
  await bringSpeakerToStage(eventId, speakerId, auth.actorRole);
  revalidateSpeakerSurfaces(eventId);
}

/** Send backstage: the stage grant is revoked and the speaker is dropped from the stage room. */
export async function sendSpeakerBackstageAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const speakerId = field(formData, "speakerId");
  if (!eventId || !speakerId) return;
  const auth = await requireControl(eventId);
  await sendSpeakerBackstage(eventId, speakerId, auth.actorRole);
  await removeLiveKitParticipantFromMainStage({ eventId, stageId: "main-stage", attendeeId: speakerId }).catch(() => undefined);
  revalidateSpeakerSurfaces(eventId);
}

/** The producer writes or pastes cue cards, talking points, and a script; saved as the approved version. */
export async function saveProducerCueDeckAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const speakerId = field(formData, "speakerId");
  if (!eventId || !speakerId) return;
  const auth = await requireControl(eventId);
  await saveCueDeckVersion(eventId, speakerId, { cards: parseCueCardLines(field(formData, "cards")), talkingPoints: parseLines(field(formData, "talkingPoints")), script: field(formData, "script") || undefined, author: "producer", authorLabel: auth.actorRole });
  revalidateSpeakerSurfaces(eventId);
}

export async function approveSpeakerCueDeckAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const speakerId = field(formData, "speakerId");
  if (!eventId || !speakerId) return;
  const auth = await requireControl(eventId);
  if (field(formData, "decision") === "discard") await discardCueDeck(eventId, speakerId);
  else await approveCueDeck(eventId, speakerId, auth.actorRole);
  revalidateSpeakerSurfaces(eventId);
}

/** A live cue ("wrap in 2 min", "next question") shown as a banner on the speaker's view within ~5s. */
export async function pushLiveCueAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const speakerId = field(formData, "speakerId");
  if (!eventId || !speakerId) return;
  const auth = await requireControl(eventId);
  const text = field(formData, "cue");
  if (text) await pushSpeakerLiveCue(eventId, speakerId, text, auth.actorRole);
  else await clearSpeakerLiveCue(eventId, speakerId, auth.actorRole);
  revalidateSpeakerSurfaces(eventId);
}

export async function saveProducerNotesAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  const auth = await requireControl(eventId);
  await saveProducerNotes(eventId, field(formData, "notes"), auth.actorRole);
  revalidateSpeakerSurfaces(eventId);
}

export async function setVipRoomAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  const auth = await requireControl(eventId);
  await setVipRoomOpen(eventId, field(formData, "open") === "true", auth.actorRole);
  revalidateSpeakerSurfaces(eventId);
}
