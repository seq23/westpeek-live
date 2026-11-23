"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { appendRequestEventRecord } from "@/services/events/requestEventStore";
import { createAuditLog } from "@/services/audit/createAuditLog";
import { sendEmail } from "@/services/email/emailService";
import { escapeHtml } from "@/services/email/emailWorkflowTemplates";
import { createEventRecord } from "@/services/events/eventRepository";
import { attachEventToRequest } from "@/services/event-intake/eventRequestPipeline";
import { budgetRangeLabel, isBudgetRange } from "@/types/eventRequest";
import { admitEventRequest } from "@/services/events/requestEventAdmission";
import { requestIpHash } from "@/services/access/gateAttemptLimiter";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/security/turnstile";

/**
 * Public event-request intake.
 *
 * This action used to end in an unconditional
 * `redirect("/request-event?status=received")`. Nothing on the path to it could
 * make it not run: the store returned the same record whether or not it had
 * persisted anything, `sendEmail` failures were swallowed into an audit log,
 * and `createAuditLog` swallows its own errors by design. So there were three
 * independent ways for a request to vanish, all of which still told the visitor
 * their request had been received.
 *
 * The rule now: the success page is reachable only if at least one durable
 * destination confirmed the request. Storage confirming is enough. Email
 * confirming is enough. Neither confirming is a failure, and it is shown as
 * one, with an address the visitor can use instead.
 */

function field(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function notificationRecipient() {
  const env = getEnv();
  if (env.EMAIL_REPLY_TO) return env.EMAIL_REPLY_TO;
  const from = env.EMAIL_FROM || "";
  const match = from.match(/<([^>]+)>/);
  return match?.[1] || (from.includes("@") ? from : "");
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function requestEventProduction(formData: FormData) {
  const name = field(formData, "name");
  const email = field(formData, "email");
  // Budget joined name and email as required on 16 Sep 2026. It is a band from a fixed list, so an
  // unrecognised value is a tampered form rather than a typo, and is refused the same way.
  const budgetRange = field(formData, "budgetRange");
  if (!name || !email || !email.includes("@") || !isBudgetRange(budgetRange)) redirect("/request-event?status=missing");

  // Nothing is written or sent until the sender is counted and the bot check has had its say
  // (services/events/requestEventAdmission.ts): every request mails the owner and makes a draft event.
  const { ip } = await requestIpHash({ headers: await headers() });
  const admission = await admitEventRequest({ ip, turnstileToken: String(formData.get(TURNSTILE_RESPONSE_FIELD) || "") });
  if (!admission.admitted) {
    console.error(`request-event: refused (${admission.reason})`);
    redirect(`/request-event?status=${admission.status}`);
  }

  const persisted = await appendRequestEventRecord({
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    email,
    company: field(formData, "company"),
    eventType: field(formData, "eventType"),
    eventDate: field(formData, "eventDate"),
    audienceSize: field(formData, "audienceSize"),
    livestreamNeeds: field(formData, "livestreamNeeds"),
    networkingNeeds: field(formData, "networkingNeeds"),
    sponsorExpoNeeds: field(formData, "sponsorExpoNeeds"),
    speakerCount: field(formData, "speakerCount"),
    supportLevel: field(formData, "supportLevel"),
    notes: field(formData, "notes"),
    budgetRange,
    requesterIpHash: admission.requesterIpHash,
    botCheck: admission.botCheck,
    createdAt: new Date().toISOString(),
  });
  const unchecked = admission.botCheck === "unchecked";

  const record = persisted.record;

  // Besides the inbox record, a planned (LATER) draft event lands in the owner's
  // workspace so the request is actionable without retyping it. This is a
  // best-effort second destination: a failure here never changes the receipt
  // decision, which stays with the inbox row and the delivered email.
  let draftEventId: string | undefined;
  try {
    const draft = await createEventRecord({
      name: `${record.company || name} — ${record.eventType || "event"} request`.slice(0, 120),
      when: "later",
      eventType: record.eventType?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "webinar",
      clientName: record.company || undefined,
      startAt: record.eventDate && !Number.isNaN(new Date(record.eventDate).getTime()) ? new Date(record.eventDate).toISOString() : undefined,
      description: [record.audienceSize && `Audience: ${record.audienceSize}`, record.notes].filter(Boolean).join(" · ").slice(0, 240) || undefined,
      source: "request",
    }, { kind: "user", id: `request:${email}`, label: `${name} via /request-event`, role: "public_visitor" });
    draftEventId = draft.id;
    // Link the draft back to the request, so the instruction emails sent after payment carry THAT
    // event's codes rather than a second event nobody created. Best effort like the draft itself.
    await attachEventToRequest(record.id, draft.id).catch(() => undefined);
  } catch (error) {
    console.error(`request-event: draft event not created for ${record.id}: ${errorMessage(error)}`);
  }

  await createAuditLog({
    agencyId: "west-peek-productions",
    actorUserId: email,
    actorRole: "public_visitor",
    action: "request_event_production",
    resourceType: "request_event_intake",
    resourceId: record.id,
    visibility: "internal_agency",
    newValue: draftEventId ? { draftEventId } : undefined,
  });

  if (!persisted.ok) {
    // Storage failed. Record why, so a dropped request leaves a trace even when
    // the email path also fails. createAuditLog swallows its own errors, so
    // this is a best-effort breadcrumb rather than a guarantee — which is
    // exactly why it is not what the success decision is based on.
    await createAuditLog({
      agencyId: "west-peek-productions",
      actorUserId: "system",
      actorRole: "system",
      action: "request_event_persist_failed",
      resourceType: "request_event_intake",
      resourceId: record.id,
      visibility: "internal_agency",
      newValue: { reason: persisted.reason },
    });
    // createAuditLog does not forward newValue into the stored log, and it
    // swallows its own failures, so this is the line that actually reaches an
    // operator via `wrangler tail`.
    console.error(`request-event: intake not stored (${persisted.reason}) for ${record.id}`);
  }

  // A "sent" result from the real provider is the only email outcome that
  // counts. MockEmailProvider returns provider "mock" and discards the message,
  // which is what happens whenever RESEND_API_KEY or EMAIL_FROM is unset on the
  // Worker, and an unconfigured mailer must never look like a delivered one.
  let emailDelivered = false;
  const to = notificationRecipient();

  if (to) {
    try {
      const result = await sendEmail({
        to,
        // An unchecked request came in without the bot check (most often an ad blocker); the owner sees that before opening it.
        subject: `New West Peek Live event request${unchecked ? " (bot check not run)" : ""}: ${name.replace(/\s+/g, " ").slice(0, 120)}`,
        replyTo: email,
        // Every value here was typed by a stranger, so it is escaped before it becomes markup in the owner's inbox.
        html: `<h1>New event request</h1>${[
          ["Name", name],
          ["Email", email],
          ["Company", record.company || ""],
          ["Event type", record.eventType || ""],
          ["Date", record.eventDate || ""],
          ["Audience", record.audienceSize || ""],
          ["Budget", budgetRangeLabel(record.budgetRange)],
          ["Notes", record.notes || ""],
          ...(draftEventId ? [["Draft event", `${getEnv().NEXT_PUBLIC_APP_URL}/app/events/${draftEventId}`]] : []),
        ].map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}`,
        text: `New event request
Name: ${name}
Email: ${email}
Company: ${record.company || ""}
Event type: ${record.eventType || ""}
Date: ${record.eventDate || ""}
Audience: ${record.audienceSize || ""}
Budget: ${budgetRangeLabel(record.budgetRange)}
Notes: ${record.notes || ""}${draftEventId ? `
Draft event: ${getEnv().NEXT_PUBLIC_APP_URL}/app/events/${draftEventId}` : ""}`,
      });

      emailDelivered = result.provider === "resend" && result.status === "sent";
    } catch (error) {
      await createAuditLog({
        agencyId: "west-peek-productions",
        actorUserId: "system",
        actorRole: "system",
        action: "request_event_notification_failed",
        resourceType: "request_event_intake",
        resourceId: record.id,
        visibility: "internal_agency",
        newValue: { reason: errorMessage(error) },
      });
      console.error(`request-event: notification failed for ${record.id}: ${errorMessage(error)}`);
    }
  }

  // Storage confirmed, or the notification was genuinely delivered. Either is a
  // real destination. Neither is not.
  if (persisted.ok || emailDelivered) redirect("/request-event?status=received");

  redirect("/request-event?status=failed");
}
