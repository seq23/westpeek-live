"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCrewViewer, viewerCan } from "@/lib/auth/crewViewer";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { sendGroupEmail } from "@/services/email/groupEmailService";
import { recordResubscribe, recordUnsubscribe } from "@/services/email/emailSuppressionService";
import { isAudienceKind } from "@/types/emailAudience";
import type { EmailWorkflowType } from "@/types/emailWorkflows";

/**
 * The composer's one write, and the two unsubscribe-list corrections beside it.
 *
 * A person pressed each of these. Nothing here is reachable from a timer, a webhook or a queue, and
 * the send action re-checks the audience, the count and the daily allowance before anything leaves.
 */
function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function composeUrl(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const suffix = query.toString();
  return `/app/email/compose${suffix ? `?${suffix}` : ""}`;
}

/**
 * Send to the resolved audience.
 *
 * With an event, the guard is the same one the rest of the event's controls use. Without one — a
 * message to one person across events — there is no event to scope a crew cookie to, so the owner
 * or operator cookie is required: a crew member holding a link to one show cannot mail outside it.
 */
export async function sendGroupEmailAction(formData: FormData): Promise<void> {
  const eventId = clean(formData.get("eventId"));
  const audience = clean(formData.get("audience"));
  if (!isAudienceKind(audience)) return;

  let sentBy: string;
  if (eventId) {
    const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_access_codes");
    if (!auth.ok) throw new Error(auth.error);
    sentBy = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  } else {
    const viewer = await getCrewViewer();
    if (viewer.kind !== "owner" && viewer.kind !== "operator") {
      throw new Error("Sending without an event reaches people across every show, so it takes an owner or operator sign-in.");
    }
    sentBy = viewer.kind;
  }

  const workflow = clean(formData.get("workflow"));
  const expected = clean(formData.get("expectedCount"));
  const result = await sendGroupEmail({
    eventId: eventId || undefined,
    audience,
    oneOff: clean(formData.get("oneOff")) || undefined,
    workflow: workflow ? (workflow as EmailWorkflowType) : undefined,
    subject: clean(formData.get("subject")) || undefined,
    body: clean(formData.get("body")) || undefined,
    expectedCount: expected ? Number(expected) : undefined,
    sentBy,
  });

  for (const path of ["/app/email", "/app/email/compose", eventId ? `/app/events/${eventId}/communications` : "/app/email"]) revalidatePath(path);
  redirect(composeUrl({
    event: eventId || undefined,
    audience,
    ...(result.ok
      ? { sent: String(result.sent) }
      : { composeError: result.reason || `${result.failed} message${result.failed === 1 ? "" : "s"} failed` }),
  }));
}

/** Crew putting somebody back on the list, or taking them off it by hand at their request. */
export async function setUnsubscribeAction(formData: FormData): Promise<void> {
  const viewer = await getCrewViewer();
  if (!viewerCan(viewer, "manage_access_codes")) throw new Error("Changing West Peek's unsubscribe list takes an owner or operator sign-in.");
  const email = clean(formData.get("email"));
  const intent = clean(formData.get("intent"));
  if (!email) return;
  if (intent === "resubscribe") await recordResubscribe({ email, by: viewer.kind });
  else await recordUnsubscribe({ email, source: "crew" });
  for (const path of ["/app/email", "/app/email/compose"]) revalidatePath(path);
  redirect("/app/email/compose?list=1");
}
