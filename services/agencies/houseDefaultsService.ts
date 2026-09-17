import { getEmailReplyTo, getEnv } from "@/lib/env";
import { BRAND_FROM_EMAIL, BRAND_REPLY_TO } from "@/lib/brand";
import { livekitTier } from "@/lib/capacity/capacityPlans";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { DEFAULT_ATTENDEE_SESSION_DAYS } from "@/types/attendeeSession";
import { DEFAULT_REGISTRATION_QUESTIONS, MAX_REGISTRATION_QUESTIONS } from "@/types/attendeeRegistration";
import { SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";
import { HOUSE_DEFAULTS_ID, isSendableAddress, type HouseDefaultsRecord } from "@/types/houseDefaults";
import type { RegistrationQuestion } from "@/types/attendeeRegistration";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The house defaults, and the floor underneath them.
 *
 * Every field falls back to what the code or the environment already did, so an install with no row
 * behaves exactly as it did before this existed. Each one is consumed somewhere — a default that
 * saves and changes nothing is worse than no default — and the consumer is named in the comment.
 */
export const HOUSE_TIMEZONE_FALLBACK = "America/Chicago";

/** The floor: what each field means when the row has never been saved. */
export function houseDefaultsFloor(): HouseDefaultsRecord {
  let replyTo = "";
  let from = "";
  try {
    replyTo = getEmailReplyTo() || "";
    from = String(getEnv().EMAIL_FROM || "");
  } catch {
    replyTo = "";
  }
  return {
    id: HOUSE_DEFAULTS_ID,
    fromEmail: from || BRAND_FROM_EMAIL,
    replyToEmail: replyTo || BRAND_REPLY_TO,
    logoStoragePath: "",
    logoFileName: "",
    defaultTimezone: HOUSE_TIMEZONE_FALLBACK,
    defaultNetworkingMatchMinutes: SPEED_NETWORKING_DEFAULT_MINUTES,
    defaultAttendeeSessionDays: DEFAULT_ATTENDEE_SESSION_DAYS,
    defaultRegistrationQuestions: DEFAULT_REGISTRATION_QUESTIONS,
    livekitTier: "",
    starterTemplatesInstalledAt: "",
    updatedBy: "default",
    updatedByLabel: "Repo default",
    updatedAt: "",
  };
}

/** A stored field only wins when it actually says something; a blank column never blanks the floor. */
function merge(stored: HouseDefaultsRecord | undefined): HouseDefaultsRecord {
  const floor = houseDefaultsFloor();
  if (!stored) return floor;
  return {
    ...floor,
    ...stored,
    fromEmail: stored.fromEmail || floor.fromEmail,
    replyToEmail: stored.replyToEmail || floor.replyToEmail,
    defaultTimezone: stored.defaultTimezone || floor.defaultTimezone,
    defaultNetworkingMatchMinutes: stored.defaultNetworkingMatchMinutes || floor.defaultNetworkingMatchMinutes,
    defaultAttendeeSessionDays: stored.defaultAttendeeSessionDays || floor.defaultAttendeeSessionDays,
    defaultRegistrationQuestions: stored.defaultRegistrationQuestions?.length ? stored.defaultRegistrationQuestions : floor.defaultRegistrationQuestions,
  };
}

export async function getHouseDefaults(): Promise<HouseDefaultsRecord> {
  const stored = await getRuntimeStore().getHouseDefaults(HOUSE_DEFAULTS_ID).catch(() => undefined);
  return merge(stored);
}

/** The tier the capacity readout should use: the setting when set, otherwise LIVEKIT_TIER. */
export async function houseLivekitTier() {
  const defaults = await getHouseDefaults();
  return defaults.livekitTier || livekitTier();
}

export type SaveHouseDefaultsResult = { ok: true; defaults: HouseDefaultsRecord } | { ok: false; reason: string };

export interface SaveHouseDefaultsInput {
  fromEmail: string;
  replyToEmail: string;
  defaultTimezone: string;
  defaultNetworkingMatchMinutes: number;
  defaultAttendeeSessionDays: number;
  defaultRegistrationQuestions: RegistrationQuestion[];
  livekitTier: string;
}

/**
 * Save. Each bound is the one the consumer already enforced, so a value that saves here is a value
 * that survives the round trip: networking clamps 1–30, the session lifetime 1–365, the question
 * list to the same eight the per-event editor allows.
 */
export async function saveHouseDefaults(input: SaveHouseDefaultsInput, actor: WorkspaceActor): Promise<SaveHouseDefaultsResult> {
  const fromEmail = input.fromEmail.trim().toLowerCase();
  const replyToEmail = input.replyToEmail.trim().toLowerCase();
  if (!isSendableAddress(fromEmail)) return { ok: false, reason: "The from address has to be a real address, like notifications@events.westpeek.live." };
  if (!isSendableAddress(replyToEmail)) return { ok: false, reason: "The reply-to has to be a real address — it is where a reply lands." };
  const timezone = input.defaultTimezone.trim();
  if (!timezone) return { ok: false, reason: "A default timezone is needed: new events open on it." };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { ok: false, reason: `"${timezone}" is not a timezone this runtime knows. Use an IANA name like America/Chicago.` };
  }
  const tier = input.livekitTier.trim().toLowerCase();
  if (tier && tier !== "build" && tier !== "ship" && tier !== "scale") return { ok: false, reason: "The LiveKit tier is build, ship or scale — or blank to follow the environment." };
  const current = await getHouseDefaults();
  const record: HouseDefaultsRecord = {
    ...current,
    id: HOUSE_DEFAULTS_ID,
    fromEmail,
    replyToEmail,
    defaultTimezone: timezone,
    defaultNetworkingMatchMinutes: Math.max(1, Math.min(30, Math.round(Number(input.defaultNetworkingMatchMinutes) || SPEED_NETWORKING_DEFAULT_MINUTES))),
    defaultAttendeeSessionDays: Math.max(1, Math.min(365, Math.round(Number(input.defaultAttendeeSessionDays) || DEFAULT_ATTENDEE_SESSION_DAYS))),
    defaultRegistrationQuestions: input.defaultRegistrationQuestions.slice(0, MAX_REGISTRATION_QUESTIONS),
    livekitTier: (tier || "") as HouseDefaultsRecord["livekitTier"],
    updatedBy: actor.id,
    updatedByLabel: actor.label,
    updatedAt: new Date().toISOString(),
  };
  try {
    await getRuntimeStore().setHouseDefaults(record);
    return { ok: true, defaults: record };
  } catch (error) {
    return { ok: false, reason: `Could not save the house defaults: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** The logo is written by the upload path, not the settings form, so it saves on its own. */
export async function setHouseLogo(input: { storagePath: string; fileName: string }, actor: WorkspaceActor) {
  const current = await getHouseDefaults();
  const record: HouseDefaultsRecord = {
    ...current,
    logoStoragePath: input.storagePath.trim(),
    logoFileName: input.fileName.trim(),
    updatedBy: actor.id,
    updatedByLabel: actor.label,
    updatedAt: new Date().toISOString(),
  };
  await getRuntimeStore().setHouseDefaults(record);
  return record;
}

/** Stamp the starter-template install. Separate from saveHouseDefaults so a save never re-stamps it. */
export async function markStarterTemplatesInstalled(at: string) {
  const current = await getHouseDefaults();
  if (current.starterTemplatesInstalledAt) return current;
  const record: HouseDefaultsRecord = { ...current, starterTemplatesInstalledAt: at };
  await getRuntimeStore().setHouseDefaults(record);
  return record;
}
