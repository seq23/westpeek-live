"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { mergeAttendeeProfile, type ProfilePatch } from "@/services/attendees/attendeeProfileMerge";
import { applyAnswers } from "@/services/attendees/registrationQuestions";
import { upsertContactFromProfile } from "@/services/attendees/contactsService";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function revalidateProfileSurfaces(eventId: string) {
  for (const path of [`/venue/${eventId}/people`, `/venue/${eventId}/networking`, `/venue/${eventId}/stage`, `/venue/${eventId}/lobby`]) revalidatePath(path);
}

/** The one profile write path: every field the form sent is merged; a field it did not send is left alone. */
export async function updateAttendeeProfileAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  if (!eventId) throw new Error("Profile update requires event identity.");
  const profile = await getCurrentAttendeeProfile(eventId);
  if (!profile) throw new Error("Register before editing your attendee profile.");
  const patch: ProfilePatch = {};
  for (const key of ["name", "company", "title", "personalWebsite", "socialLinks", "reasonForAttending", "interestingFact", "topicsOfInterest", "networkingGoals"] as const) {
    if (formData.has(key)) patch[key] = clean(formData.get(key));
  }
  // Checkboxes: present in the form only when the form carries the marker field; unchecked means false.
  if (formData.has("hasNetworkingOptIn")) patch.networkingOptIn = formData.get("networkingOptIn") === "on";
  if (formData.has("hasHiddenFromDirectory")) patch.hiddenFromDirectory = formData.get("hiddenFromDirectory") === "on";
  // Answers to the event's questions arrive as answer:<key>; the legacy four also fill their columns.
  const answers: Record<string, string> = {};
  formData.forEach((value, key) => { if (key.startsWith("answer:") && typeof value === "string") answers[key.slice("answer:".length)] = value; });
  const merged = applyAnswers(mergeAttendeeProfile(profile, patch), answers);
  await getRuntimeStore().upsertAttendeeProfile(merged);
  await upsertContactFromProfile(merged);
  revalidateProfileSurfaces(eventId);
  const returnTo = clean(formData.get("returnTo"));
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=profile#tell-us-more`);
}
