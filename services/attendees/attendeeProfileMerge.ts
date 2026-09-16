import type { AttendeeProfile } from "@/types/attendeeRegistration";
import { normalizeWebsite } from "@/services/attendees/attendeeRegistrationService";

/**
 * "Tell us more about you": the one write path for everything registration no longer asks.
 * Pure merge: a field the form did not send is left alone; a sent empty field clears it; lists are
 * split on newlines / commas and capped; the website gets its scheme. Also computes the "N of 7"
 * progress cue. Used by the stage / lobby card, the profile panel, and the networking gate.
 */
export const TELL_US_MORE_FIELDS = ["title", "personalWebsite", "socialLinks", "reasonForAttending", "interestingFact", "topicsOfInterest", "networkingGoals"] as const;
export type TellUsMoreField = (typeof TELL_US_MORE_FIELDS)[number];

export interface ProfilePatch {
  name?: string;
  company?: string;
  title?: string;
  personalWebsite?: string;
  socialLinks?: string;
  reasonForAttending?: string;
  interestingFact?: string;
  topicsOfInterest?: string;
  networkingGoals?: string;
  networkingOptIn?: boolean;
  hiddenFromDirectory?: boolean;
}

export function splitList(value: string | undefined) {
  return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

export function mergeAttendeeProfile(profile: AttendeeProfile, patch: ProfilePatch, now = new Date().toISOString()): AttendeeProfile {
  const text = (key: "title" | "reasonForAttending" | "interestingFact" | "networkingGoals") => (patch[key] === undefined ? profile[key] : String(patch[key]).trim() || undefined);
  return {
    ...profile,
    name: patch.name === undefined ? profile.name : String(patch.name).trim() || profile.name,
    company: patch.company === undefined ? profile.company : String(patch.company).trim() || profile.company,
    title: text("title") || "",
    personalWebsite: patch.personalWebsite === undefined ? profile.personalWebsite : normalizeWebsite(patch.personalWebsite),
    socialLinks: patch.socialLinks === undefined ? profile.socialLinks : splitList(patch.socialLinks),
    reasonForAttending: text("reasonForAttending"),
    interestingFact: text("interestingFact"),
    topicsOfInterest: patch.topicsOfInterest === undefined ? profile.topicsOfInterest : splitList(patch.topicsOfInterest),
    networkingGoals: text("networkingGoals"),
    networkingOptIn: patch.networkingOptIn === undefined ? profile.networkingOptIn : patch.networkingOptIn,
    hiddenFromDirectory: patch.hiddenFromDirectory === undefined ? Boolean(profile.hiddenFromDirectory) : patch.hiddenFromDirectory,
    updatedAt: now,
  };
}

/** How many of the seven "tell us more" fields are filled. */
export function tellUsMoreProgress(profile: AttendeeProfile) {
  const filled = TELL_US_MORE_FIELDS.filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value && String(value).trim());
  }).length;
  return { filled, total: TELL_US_MORE_FIELDS.length };
}

/** Who the People page lists: registered, active, and not hidden by their own switch. */
export function visibleInDirectory(profile: Pick<AttendeeProfile, "status" | "hiddenFromDirectory">) {
  return profile.status === "active" && !profile.hiddenFromDirectory;
}
