"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperatorAccessForRequest } from "@/lib/auth/operatorRequestGuard";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { createAuditLog } from "@/services/audit/createAuditLog";
import { findEventRecord } from "@/services/events/eventRepository";
import {
  approveEventRequest,
  confirmEventRequestByToken,
  declineEventRequest,
  getEventRequest,
  recordInstructionsSent,
  recordSettlement,
} from "@/services/event-intake/eventRequestPipeline";
import {
  emptyInstructionRecipients,
  INSTRUCTION_AUDIENCES,
  parseAddressList,
  sendApprovalEmail,
  sendInstructionEmails,
  type InstructionRecipients,
} from "@/services/event-intake/eventRequestEmails";

/**
 * Moving a request along. Four actions, each of them something a person pressed.
 *
 * Three are West Peek's and sit behind the operator gate (an owner cookie opens it too). The
 * fourth is the client's, and it is the only one a visitor can reach: it takes a token and nothing
 * else, so nobody can confirm a request by guessing an id.
 *
 * Email is sent from exactly two of them, both times immediately after the click that caused it:
 * Approve sends the client their scope, and Mark paid sends the instructions. There is no timer,
 * no queue drain, and no state change anywhere in the app that mails somebody as a side effect.
 */
function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

/** Dollars as a person types them ("4,500", "4500.00") into whole cents. NaN when it is not money. */
function dollarsToCents(raw: string) {
  const normalized = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

/** Always throws, like redirect() does, so the caller's narrowing survives past the call. */
function back(query: string): never {
  redirect(`/app/requests?${query}`);
}

async function requireWestPeek() {
  const auth = await requireOperatorAccessForRequest();
  if (!auth.ok) throw new Error(auth.error);
  return auth.actorRole;
}

/** Attach a price and a scope, and send the client the link that shows both. */
export async function approveEventRequestAction(formData: FormData) {
  const actorRole = await requireWestPeek();
  const id = clean(formData.get("requestId"));
  if (!id) return;
  const priceAmountCents = dollarsToCents(clean(formData.get("price")));
  if (!Number.isFinite(priceAmountCents)) back(`requestError=${encodeURIComponent("Write the price as a number, like 4500 or 4500.00.")}`);

  const approved = await approveEventRequest({
    id,
    priceAmountCents,
    priceCurrency: clean(formData.get("currency")) || "USD",
    scopeSummary: clean(formData.get("scopeSummary")),
    approvedBy: actorRole,
  });
  if (!approved.ok) back(`requestError=${encodeURIComponent(approved.reason)}`);

  const sent = await sendApprovalEmail({ request: approved.request, baseUrl: await appBaseUrl(), sentBy: actorRole });
  await createAuditLog({
    agencyId: "west-peek-productions",
    actorUserId: actorRole,
    actorRole,
    action: "event_request_approved",
    resourceType: "request_event_intake",
    resourceId: id,
    visibility: "internal_agency",
  });

  revalidatePath("/app/requests");
  // The provider is named back to the operator: a "mock" row means nothing left the building, and
  // she needs to know that at the moment she pressed the button, not when the client never replies.
  back(`approved=${encodeURIComponent(approved.request.email)}&provider=${sent.provider}`);
}

export async function declineEventRequestAction(formData: FormData) {
  const actorRole = await requireWestPeek();
  const id = clean(formData.get("requestId"));
  if (!id) return;
  const result = await declineEventRequest({ id, reason: clean(formData.get("declineReason")), declinedBy: actorRole });
  if (!result.ok) back(`requestError=${encodeURIComponent(result.reason)}`);
  await createAuditLog({
    agencyId: "west-peek-productions",
    actorUserId: actorRole,
    actorRole,
    action: "event_request_declined",
    resourceType: "request_event_intake",
    resourceId: id,
    visibility: "internal_agency",
  });
  revalidatePath("/app/requests");
  back("declined=1");
}

/**
 * The money arrived, so the instructions go out.
 *
 * Settlement is manual today: somebody at West Peek saw the payment and pressed this. The state it
 * writes and the send it triggers are exactly what a payment provider's webhook would drive later,
 * which is why both go through recordSettlement rather than being written here.
 */
export async function markRequestPaidAction(formData: FormData) {
  const actorRole = await requireWestPeek();
  const id = clean(formData.get("requestId"));
  if (!id) return;

  const settled = await recordSettlement({
    id,
    method: "manual",
    reference: clean(formData.get("settlementReference")),
    settledBy: actorRole,
  });
  if (!settled.ok) back(`requestError=${encodeURIComponent(settled.reason)}`);

  const recipients: InstructionRecipients = emptyInstructionRecipients();
  for (const entry of INSTRUCTION_AUDIENCES) {
    recipients[entry.audience] = parseAddressList(clean(formData.get(`recipients_${entry.audience}`)));
  }
  // The client is always told, whatever was typed in the boxes: they paid for this.
  if (!recipients.client.includes(settled.request.email.toLowerCase())) recipients.client.unshift(settled.request.email.toLowerCase());

  const event = settled.request.eventId ? await findEventRecord(settled.request.eventId).catch(() => undefined) : undefined;
  const result = await sendInstructionEmails({
    request: settled.request,
    event: event || undefined,
    recipients,
    baseUrl: await appBaseUrl(),
    sentBy: actorRole,
  });
  await recordInstructionsSent(id);
  await createAuditLog({
    agencyId: "west-peek-productions",
    eventId: settled.request.eventId,
    actorUserId: actorRole,
    actorRole,
    action: "event_request_paid",
    resourceType: "request_event_intake",
    resourceId: id,
    visibility: "internal_agency",
  });

  revalidatePath("/app/requests");
  revalidatePath("/app/email");
  back(`paid=${result.sent}&failed=${result.failed}`);
}

/**
 * The client's yes. Token only: the page carries no id, so there is nothing to edit into somebody
 * else's request. It sends nothing, because nobody at West Peek has acted yet.
 */
export async function confirmProposalAction(formData: FormData) {
  const token = clean(formData.get("token"));
  if (!token) redirect("/request-event");
  const result = await confirmEventRequestByToken(token);
  if (!result.ok) redirect(`/proposal/${token}?confirmError=${encodeURIComponent(result.reason)}`);
  const request = await getEventRequest(result.request.id);
  await createAuditLog({
    agencyId: "west-peek-productions",
    actorUserId: request?.email || "client",
    actorRole: "client_owner",
    action: "event_request_confirmed",
    resourceType: "request_event_intake",
    resourceId: result.request.id,
    visibility: "internal_agency",
  });
  revalidatePath("/app/requests");
  redirect(`/proposal/${token}?confirmed=1`);
}
