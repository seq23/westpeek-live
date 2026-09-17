"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentGuestIdentity, getCurrentSpecialGuestAccess, registerGuestIdentity } from "@/services/guests/guestIdentityService";
import { markSpeakerOnStage, parseCueCardLines, parseLines, recordSpeakerTechCheck, saveCueDeckVersion, saveSponsorBooth } from "@/services/guests/guestStateService";
import type { SpecialGuestRole, SpeakerTechCheckState } from "@/types/specialGuest";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnTo(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** The special-guest cookie must carry this event and role; the person is then recorded once. */
async function requireGuestRole(eventId: string, role: SpecialGuestRole) {
  const access = await getCurrentSpecialGuestAccess(eventId);
  if (!access || access.role !== role) throw new Error(`A ${role} access code for this event is required.`);
  return access;
}

function revalidateGuestSurfaces(eventId: string) {
  for (const path of [`/speaker/events/${eventId}`, `/speaker/events/${eventId}/green-room`, `/speaker/events/${eventId}/tech-check`, `/speaker/events/${eventId}/teleprompter`, `/speaker/events/${eventId}/backstage`, `/speaker/events/${eventId}/onboarding`, `/sponsor/events/${eventId}`, `/sponsor/events/${eventId}/booth`, `/venue/${eventId}/expo`, `/venue/${eventId}/lobby`, `/crew/events/${eventId}`, `/app/events/${eventId}`, `/admin/testing/${eventId}`]) revalidatePath(path);
}

/** First entry through a role code: name / company / title / address once. */
export async function registerGuestIdentityAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const role = field(formData, "role") as SpecialGuestRole;
  const returnTo = safeReturnTo(field(formData, "returnTo"), `/${role}/events/${eventId}`);
  if (!eventId || !["speaker", "sponsor", "vip", "client"].includes(role)) return;
  await requireGuestRole(eventId, role);
  const existing = await getCurrentGuestIdentity(eventId, role);
  let error = "";
  try {
    await registerGuestIdentity({ eventId, role, name: field(formData, "name"), company: field(formData, "company"), title: field(formData, "title"), email: field(formData, "email"), existingGuestId: existing?.guestId });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not save your details.";
  }
  revalidateGuestSurfaces(eventId);
  redirect(error ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : returnTo);
}

/** The speaker records the browser tech check they just ran; the crew sees it on the roster row. */
export async function recordSpeakerTechCheckAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  await requireGuestRole(eventId, "speaker");
  const speaker = await getCurrentGuestIdentity(eventId, "speaker");
  if (!speaker) return;
  let parsed: { status?: string; score?: number; checks?: Array<{ kind: string; status: string; summary?: string }> } = {};
  try { parsed = JSON.parse(field(formData, "results") || "{}"); } catch { parsed = {}; }
  const status: SpeakerTechCheckState["status"] = parsed.status === "ready" ? "ready" : parsed.status === "warnings" ? "warnings" : "not_ready";
  await recordSpeakerTechCheck(eventId, speaker.guestId, { status, score: Number(parsed.score) || 0, checks: Array.isArray(parsed.checks) ? parsed.checks.map((check) => ({ kind: String(check.kind), status: String(check.status), summary: check.summary ? String(check.summary).slice(0, 200) : undefined })) : [] });
  revalidateGuestSurfaces(eventId);
  redirect(`/speaker/events/${eventId}/tech-check?recorded=1`);
}

/** The speaker presses "Go on stage" once the crew has brought them to the stage. */
export async function goOnStageAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  await requireGuestRole(eventId, "speaker");
  const speaker = await getCurrentGuestIdentity(eventId, "speaker");
  if (!speaker) return;
  const state = await markSpeakerOnStage(eventId, speaker.guestId);
  revalidateGuestSurfaces(eventId);
  redirect(state.status === "on_stage" ? `/speaker/events/${eventId}/backstage` : `/speaker/events/${eventId}/green-room?error=${encodeURIComponent("The crew has not brought you to the stage yet.")}`);
}

/**
 * The speaker pastes their own notes. They land as the PENDING cue-deck version until the crew
 * approves; the approved version on the teleprompter does not change. A speaker who has not
 * given their name yet is recorded from the form's name field so nothing they paste is lost.
 */
export async function submitSpeakerCueDeckAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  await requireGuestRole(eventId, "speaker");
  let speaker = await getCurrentGuestIdentity(eventId, "speaker");
  if (!speaker) speaker = await registerGuestIdentity({ eventId, role: "speaker", name: field(formData, "speakerName") || "Unnamed speaker" });
  const title = field(formData, "title");
  const notes = field(formData, "notes");
  const cards = field(formData, "cards");
  const talkingPoints = field(formData, "talkingPoints");
  const script = field(formData, "script");
  const link = field(formData, "materialUrl");
  if (!title && !notes && !cards && !talkingPoints && !script && !link) return;
  const cardList = [...parseCueCardLines(cards), ...(title || notes ? [{ title: title || "Speaker note", body: [notes, link ? `Link: ${link}` : ""].filter(Boolean).join("\n") }] : [])];
  await saveCueDeckVersion(eventId, speaker.guestId, { cards: cardList, talkingPoints: parseLines(talkingPoints), script: script || undefined, author: "speaker", authorLabel: speaker.name });
  revalidateGuestSurfaces(eventId);
  redirect(`/speaker/events/${eventId}/teleprompter?submitted=1`);
}

/** The sponsor's booth for THIS event: name, blurb, link. Shown in the venue Expo once named. */
export async function saveSponsorBoothAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  await requireGuestRole(eventId, "sponsor");
  const sponsor = await getCurrentGuestIdentity(eventId, "sponsor");
  if (!sponsor) return;
  await saveSponsorBooth(eventId, sponsor.guestId, { boothName: field(formData, "boothName"), blurb: field(formData, "blurb"), link: field(formData, "link") });
  revalidateGuestSurfaces(eventId);
  redirect(`/sponsor/events/${eventId}/booth?saved=1`);
}
