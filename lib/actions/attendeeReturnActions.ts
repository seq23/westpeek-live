"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordAnalyticsEvent } from "@/services/analytics/analyticsEventService";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { normalizeReturnEmail, restoreAttendeeOnThisDevice } from "@/services/attendees/attendeeReturnService";
import { requestIpHash } from "@/services/access/gateAttemptLimiter";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

/**
 * "I already registered." One field, the email they used, and they are back.
 *
 * A miss is never told apart from a hit in words: it lands on the ordinary registration form with
 * the address already filled in, so the guest carries on in one step and nobody learns who is on
 * the list. The rate limit lives in the service, behind the same gate limiter as the access codes.
 */
export async function restoreRegistrationOnThisDeviceAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const slug = clean(formData.get("slug")) || eventId;
  const email = normalizeReturnEmail(clean(formData.get("email")));
  if (!eventId) throw new Error("Returning to an event requires event identity.");
  const registerHref = `/events/${slug}/register`;
  if (!email.includes("@")) redirect(`${registerHref}?email=${encodeURIComponent(email)}`);

  // Same reason registration hydrates here: a server action can run in an isolate no page has warmed.
  await ensureRuntimeEvent(eventId);
  const { ip } = await requestIpHash({ headers: await headers() });
  const outcome = await restoreAttendeeOnThisDevice({ eventId, email, ip });

  if (outcome.status === "rate_limited") redirect(`${registerHref}?wait=${outcome.retryInSeconds}`);
  if (outcome.status !== "restored") redirect(`${registerHref}?email=${encodeURIComponent(email)}`);

  await recordAnalyticsEvent({
    eventId,
    kind: "registration_restored_on_new_device",
    subjectId: outcome.profile.attendeeId,
    // No address, no name: the fact of a return and whether it healed a legacy row.
    metadata: { healedEmail: outcome.healedEmail, assurance: "email_restored" },
  }).catch(() => undefined);
  redirect(`/venue/${eventId}/lobby?returned=1`);
}
