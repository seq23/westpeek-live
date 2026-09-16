"use server";

import { redirect } from "next/navigation";
import { recordAnalyticsEvent } from "@/services/analytics/analyticsEventService";
import { joinNetworkingQueue, leaveNetworkingQueue, nextNetworkingMatch, setNetworkingSettings } from "@/services/speed-networking/speedNetworkingService";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";
import { revalidatePath } from "next/cache";
import { getCurrentAttendeeIdentity, getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { upsertContactFromProfile } from "@/services/attendees/contactsService";
import { mergeAttendeeProfile } from "@/services/attendees/attendeeProfileMerge";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function joinSpeedNetworkingQueueAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  if (!eventId) throw new Error("Networking queue join requires event ID.");
  const identity = await getCurrentAttendeeIdentity(eventId);
  if (!identity) redirect(`/events/${eventId}/register?reason=networking`);

  // The networking gate: topics and a one-liner sent with the join are saved to the profile first (the one write path).
  if (formData.has("topicsOfInterest") || formData.has("networkingGoals")) {
    const profile = await getCurrentAttendeeProfile(eventId);
    if (profile) {
      const merged = mergeAttendeeProfile(profile, { topicsOfInterest: clean(formData.get("topicsOfInterest")), networkingGoals: clean(formData.get("networkingGoals")) });
      await getRuntimeStore().upsertAttendeeProfile(merged);
      await upsertContactFromProfile(merged);
    }
  }
  // The real queue: one entry per attendee per event; the matcher pairs on the next read.
  await joinNetworkingQueue(eventId, { attendeeId: identity.attendeeId, displayName: identity.displayName, company: identity.company, title: identity.title });

  await recordAnalyticsEvent({
    eventId,
    kind: "networking_joined",
    subjectId: identity.attendeeId,
    metadata: {
      attendeeId: identity.attendeeId,
      attendeeName: identity.displayName,
      attendeeCompany: identity.company,
      queueState: "waiting",
      source: "networking_queue_form",
    },
  }).catch(() => undefined);

  redirect(`/venue/${eventId}/networking?state=waiting&queued=1`);
}

/** Crew: open / close networking and set the minutes per match (manage_stage_access; owner/operator always). */
export async function updateNetworkingSettingsAction(formData: FormData): Promise<void> {
  const eventId = clean(formData.get("eventId"));
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_stage_access");
  if (!auth.ok) throw new Error(auth.error);
  const open = String(formData.get("open") || "") === "true";
  const matchMinutes = Number(formData.get("matchMinutes") || SPEED_NETWORKING_DEFAULT_MINUTES);
  await setNetworkingSettings(eventId, { open, matchMinutes }, auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole);
  for (const path of [`/crew/events/${eventId}`, `/app/events/${eventId}`, `/admin/testing/${eventId}`, `/venue/${eventId}/networking`]) revalidatePath(path);
}

/** Next match: ends the current match for both (both back to the queue) and keeps this attendee waiting. Works before hydration. */
export async function nextSpeedNetworkingMatchAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  if (!eventId) return;
  const identity = await getCurrentAttendeeIdentity(eventId);
  if (!identity) redirect(`/events/${eventId}/register?reason=networking`);
  await nextNetworkingMatch(eventId, identity.attendeeId);
  redirect(`/venue/${eventId}/networking?state=waiting&next=1`);
}

/** Leave the queue / End networking: this attendee is out; a current match ends for both. Works before hydration. */
export async function leaveSpeedNetworkingQueueAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  if (!eventId) return;
  const identity = await getCurrentAttendeeIdentity(eventId);
  if (!identity) redirect(`/events/${eventId}/register?reason=networking`);
  await leaveNetworkingQueue(eventId, identity.attendeeId, clean(formData.get("reason")) === "end" ? "ended" : "left");
  redirect(`/venue/${eventId}/networking?state=left`);
}
