import { sha256Hex, randomId } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { maskEmail, upsertContactFromProfile } from "@/services/attendees/contactsService";
import type { AttendeeProfile, AttendeeRegistrationInput, AttendeeRegistrationResult } from "@/types/attendeeRegistration";

function normalizeList(input?: string[]) {
  return Array.from(new Set((input || []).map((item) => item.trim()).filter(Boolean))).slice(0, 12);
}

export async function registerOrUpdateAttendee(input: AttendeeRegistrationInput): Promise<AttendeeRegistrationResult> {
  if (!input.eventId) throw new Error("eventId is required.");
  if (!input.name.trim()) throw new Error("Attendee name is required.");
  if (!input.email.includes("@")) throw new Error("Valid attendee email is required.");
  if (!input.company.trim()) throw new Error("Company or affiliation is required.");

  const store = getRuntimeStore();
  const now = new Date().toISOString();
  const emailHash = await sha256Hex(input.email.trim().toLowerCase());
  const existing = await store.getAttendeeProfileByEmailHash(input.eventId, emailHash).catch(() => undefined);
  const profile: AttendeeProfile = {
    attendeeId: existing?.attendeeId || randomId("attendee"),
    eventId: input.eventId,
    emailHash,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    emailMasked: maskEmail(input.email.trim().toLowerCase()),
    company: input.company.trim(),
    title: (input.title || "").trim() || existing?.title || "",
    personalWebsite: normalizeWebsite(input.personalWebsite),
    socialLinks: normalizeList(input.socialLinks),
    reasonForAttending: input.reasonForAttending?.trim() || undefined,
    interestingFact: input.interestingFact?.trim() || undefined,
    topicsOfInterest: normalizeList(input.topicsOfInterest),
    networkingGoals: input.networkingGoals?.trim() || undefined,
    networkingOptIn: input.networkingOptIn ?? existing?.networkingOptIn ?? true,
    hiddenFromDirectory: existing?.hiddenFromDirectory ?? false,
    extraAnswers: existing?.extraAnswers || {},
    role: "attendee",
    status: existing?.status || "active",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await store.upsertAttendeeProfile(profile);
  // One person across events: the contact row keyed by email grows its events list instead of duplicating.
  await upsertContactFromProfile(profile);
  return { profile, duplicateBehavior: existing ? "updated_existing_email" : "created" };
}

/** "mysite.com" is a website; nobody should have to type the scheme. Empty stays empty. */
export function normalizeWebsite(value?: string | null): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}
