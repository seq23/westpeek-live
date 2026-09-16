"use server";

import { redirect } from "next/navigation";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { recordAnalyticsEvent } from "@/services/analytics/analyticsEventService";
import { getEventConfig } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { createAttendeeSession } from "@/services/attendees/attendeeSessionService";
import { upsertAttendeeAgendaIntent } from "@/services/attendees/attendeeAgendaIntentService";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanList(value: FormDataEntryValue | null) {
  return clean(value)
    .split(/\n|,/) 
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function checkedValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
}

export async function submitEventRegistration(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const slug = clean(formData.get("slug"));
  const email = clean(formData.get("email"));
  const name = clean(formData.get("name"));
  const company = clean(formData.get("company"));
  const title = clean(formData.get("title"));
  const personalWebsite = clean(formData.get("personalWebsite"));
  const socialLinks = cleanList(formData.get("socialLinks"));
  const reasonForAttending = clean(formData.get("reasonForAttending"));
  const interestingFact = clean(formData.get("interestingFact"));
  const topicsOfInterest = cleanList(formData.get("topicsOfInterest"));
  const networkingGoals = clean(formData.get("networkingGoals"));
  const networkingOptIn = formData.get("networkingOptIn") === "on";
  const plannedSessionIds = checkedValues(formData, "plannedSessionIds");
  const plannedBreakoutIds = checkedValues(formData, "plannedBreakoutIds");
  const plannedSponsorBoothIds = checkedValues(formData, "plannedSponsorBoothIds");
  const wantsSessionReminders = formData.get("wantsSessionReminders") === "on";

  if (!eventId || !slug) throw new Error("Registration requires event identity.");
  if (!email.includes("@")) throw new Error("Registration requires a valid email address.");
  if (!name || !company || !title) throw new Error("Registration requires name, company/affiliation, and title/role.");
  // A runtime-created event must be hydrated in THIS request: a server action can run in a fresh
  // isolate where no page has loaded the overlay yet, and registration then failed with
  // "unconfigured event" for a real Room (found by the two-browser networking journey, 16 Sep 2026).
  await ensureRuntimeEvent(eventId);
  const event = getEventConfig(eventId);
  if (!event) throw new Error(`Cannot register for unconfigured event ${eventId}.`);

  const createdAt = new Date().toISOString();
  const result = await registerOrUpdateAttendee({ eventId, email, name, company, title, personalWebsite, socialLinks, reasonForAttending, interestingFact, topicsOfInterest, networkingGoals, networkingOptIn });
  await createAttendeeSession(result.profile);
  await upsertAttendeeAgendaIntent({ eventId, attendeeId: result.profile.attendeeId, plannedSessionIds, plannedBreakoutIds, plannedSponsorBoothIds, wantsSessionReminders });

  await getRuntimeStore().appendRegistration({
    id: `registration-${eventId}-${result.profile.attendeeId}-${Date.now()}`,
    eventId,
    attendeeEmailHash: result.profile.emailHash,
    status: "submitted",
    displayName: name,
    company,
    title,
    personalWebsite,
    socialLinks,
    reasonForAttending,
    interestingFact,
    createdAt,
  });

  await recordAnalyticsEvent({
    eventId,
    kind: "registration_submitted",
    subjectId: result.profile.attendeeId,
    metadata: {
      duplicateBehavior: result.duplicateBehavior,
      plannedSessionCount: plannedSessionIds.length,
      plannedBreakoutCount: plannedBreakoutIds.length,
      plannedSponsorBoothCount: plannedSponsorBoothIds.length,
      profileCompleted: Boolean(reasonForAttending || interestingFact || socialLinks.length || topicsOfInterest.length || networkingGoals),
    },
  }).catch(() => undefined);

  redirect(`/venue/${eventId}/lobby?registered=1`);
}
