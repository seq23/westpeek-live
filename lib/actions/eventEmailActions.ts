"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { parseRecipients, sendManualWorkflow } from "@/services/email/eventEmailService";
import type { EmailWorkflowType } from "@/types/emailWorkflows";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

/**
 * Send now. A person pressed this — nothing in the app mails an attendee on a timer. The guard is
 * the same one the deck uses, every send writes a log row naming the role that sent it, and the
 * outcome comes back on the page rather than in a console nobody reads.
 *
 * Both send surfaces come through here: the event's Communications page and the Email tab's
 * cross-event sender. The Email tab posts returnTo=/app/email so the answer lands where the person
 * was standing; it does not have a send path of its own, because a second path is a second set of
 * bugs and a second log.
 */
export async function sendEventEmailAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const workflow = clean(formData.get("workflow")) as EmailWorkflowType;
  // Only the two pages that host a send form; anything else would be an open redirect.
  const returnTo = clean(formData.get("returnTo")) === "/app/email" ? "/app/email" : `/app/events/${eventId}/communications`;
  if (!eventId || !workflow) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_access_codes");
  if (!auth.ok) throw new Error(auth.error);
  const sentBy = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  const result = await sendManualWorkflow({
    eventId,
    workflow,
    recipients: parseRecipients(clean(formData.get("recipients"))),
    message: clean(formData.get("message")) || undefined,
    sentBy,
  });
  for (const path of [`/app/events/${eventId}/communications`, "/app/email", `/app/events/${eventId}`]) revalidatePath(path);
  const query = result.ok ? `sent=${result.sent}&workflow=${workflow}` : `emailError=${encodeURIComponent(result.reason || `${result.failed} message${result.failed === 1 ? "" : "s"} failed`)}`;
  redirect(`${returnTo}?${query}`);
}
