import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { BUDGET_RANGES, budgetRangeLabel, formatPrice, type EventRequestRecord, type EventRequestState, type SettlementMethod } from "@/types/eventRequest";

/**
 * Plan an event, end to end.
 *
 * Before today /request-event took a request and that was the end of it: nothing priced it, the
 * client had no way to say yes, and no instructions ever went out. This is the whole path, and it
 * is one row the whole way:
 *
 *   requested  — the visitor filled the form in. Nobody has looked at it.
 *   approved   — West Peek attached a price and a scope and SENT the client their link.
 *   confirmed  — the client read the scope, agreed to the price, and said yes.
 *   paid       — the money is in, and the instruction emails went out with it.
 *   declined   — West Peek is not taking it, with a reason the client was told.
 *
 * Every move is something a person did. Nothing here runs on a timer, and no state advances on its
 * own: `confirm` needs the client's click, `settle` needs somebody at West Peek (or, later, a
 * payment provider) to say the money arrived.
 */
export { BUDGET_RANGES, budgetRangeLabel, formatPrice };

const CONFIRM_TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * The client's link. 24 characters of crypto randomness: this is the only thing standing between a
 * stranger and somebody else's price, so it is not derived from the id, the name, or the clock.
 * Web Crypto, not node:crypto — the Worker runtime has no node:crypto on the public path.
 */
export function mintConfirmToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CONFIRM_TOKEN_ALPHABET[byte % CONFIRM_TOKEN_ALPHABET.length]).join("");
}

export interface EventRequestInput {
  id?: string;
  name: string;
  email: string;
  company?: string;
  eventType?: string;
  eventDate?: string;
  audienceSize?: string;
  livestreamNeeds?: string;
  networkingNeeds?: string;
  sponsorExpoNeeds?: string;
  speakerCount?: string;
  supportLevel?: string;
  notes?: string;
  budgetRange?: string;
  createdAt?: string;
}

export type EventRequestWriteResult =
  | { ok: true; request: EventRequestRecord }
  | { ok: false; request: EventRequestRecord; reason: string };

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function newRequestRecord(input: EventRequestInput): EventRequestRecord {
  const now = input.createdAt || new Date().toISOString();
  return {
    id: input.id || `request-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: input.name,
    email: input.email,
    company: input.company || undefined,
    eventType: input.eventType || undefined,
    eventDate: input.eventDate || undefined,
    audienceSize: input.audienceSize || undefined,
    livestreamNeeds: input.livestreamNeeds || undefined,
    networkingNeeds: input.networkingNeeds || undefined,
    sponsorExpoNeeds: input.sponsorExpoNeeds || undefined,
    speakerCount: input.speakerCount || undefined,
    supportLevel: input.supportLevel || undefined,
    notes: input.notes || undefined,
    budgetRange: input.budgetRange || undefined,
    state: "requested",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Store one request. Never throws: the public front door needs a decision about what to show the
 * visitor, not an exception, and an intake path that can 500 is an intake path that loses requests.
 */
export async function submitEventRequest(input: EventRequestInput): Promise<EventRequestWriteResult> {
  const request = newRequestRecord(input);
  try {
    await getRuntimeStore().upsertEventRequest(request);
    return { ok: true, request };
  } catch (error) {
    return { ok: false, request, reason: `insert_failed:${errorMessage(error)}` };
  }
}

export async function listEventRequests(limit = 500) {
  return getRuntimeStore().listEventRequests(limit);
}

export async function getEventRequest(id: string) {
  return getRuntimeStore().getEventRequest(id);
}

export async function getEventRequestByConfirmToken(token: string) {
  return getRuntimeStore().getEventRequestByConfirmToken(token);
}

/** Requests grouped the way the owner reads the list: what is waiting on her, first. */
export function sortRequestsByAttention(requests: EventRequestRecord[]) {
  const order: Record<EventRequestState, number> = { requested: 0, confirmed: 1, approved: 2, paid: 3, declined: 4 };
  return requests.slice().sort((a, b) => (order[a.state] - order[b.state]) || b.createdAt.localeCompare(a.createdAt));
}

export type PipelineResult =
  | { ok: true; request: EventRequestRecord }
  | { ok: false; reason: string };

async function save(request: EventRequestRecord): Promise<PipelineResult> {
  try {
    await getRuntimeStore().upsertEventRequest(request);
    return { ok: true, request };
  } catch (error) {
    return { ok: false, reason: `Could not save the request: ${errorMessage(error)}` };
  }
}

/**
 * Attach a price and a scope, and mint the client's link.
 *
 * This is deliberately one step rather than "save a draft price" and "send it later": a price
 * sitting in the workspace that the client has never seen is a thing to forget. The caller sends
 * the approval email straight after, because a person pressed Approve.
 */
export async function approveEventRequest(input: {
  id: string;
  priceAmountCents: number;
  priceCurrency?: string;
  scopeSummary: string;
  approvedBy: string;
}): Promise<PipelineResult> {
  const request = await getEventRequest(input.id);
  if (!request) return { ok: false, reason: "That request no longer exists." };
  if (request.state === "paid") return { ok: false, reason: "That request is already paid; re-pricing it would leave the client looking at a price nobody agreed." };
  if (!Number.isFinite(input.priceAmountCents) || input.priceAmountCents <= 0) return { ok: false, reason: "A price is required, and it has to be more than nothing." };
  const scopeSummary = input.scopeSummary.trim();
  if (scopeSummary.length < 20) return { ok: false, reason: "Write the client a real scope summary: what we are doing, in a sentence or two." };
  const now = new Date().toISOString();
  return save({
    ...request,
    state: "approved",
    scopeSummary,
    priceAmountCents: Math.round(input.priceAmountCents),
    priceCurrency: input.priceCurrency || "USD",
    // Re-pricing keeps the link the client already has: a second token would strand the first email.
    confirmToken: request.confirmToken || mintConfirmToken(),
    approvedAt: now,
    approvedBy: input.approvedBy,
    // Re-pricing after a confirmation is a new offer, so the yes goes with it.
    confirmedAt: undefined,
    declinedAt: undefined,
    declineReason: undefined,
    updatedAt: now,
  });
}

export async function declineEventRequest(input: { id: string; reason: string; declinedBy: string }): Promise<PipelineResult> {
  const request = await getEventRequest(input.id);
  if (!request) return { ok: false, reason: "That request no longer exists." };
  if (request.state === "paid") return { ok: false, reason: "That request is paid. Declining it now would hide work West Peek has been paid for." };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, reason: "Say why, so the client is told something rather than nothing." };
  const now = new Date().toISOString();
  return save({ ...request, state: "declined", declinedAt: now, declineReason: reason, approvedBy: request.approvedBy || input.declinedBy, updatedAt: now });
}

/** Attach the draft event this request became, so the instruction links carry that event's codes. */
export async function attachEventToRequest(id: string, eventId: string): Promise<PipelineResult> {
  const request = await getEventRequest(id);
  if (!request) return { ok: false, reason: "That request no longer exists." };
  return save({ ...request, eventId, updatedAt: new Date().toISOString() });
}

/**
 * The client said yes. Resolved by token alone — the page the client is looking at carries no id
 * they could edit into somebody else's request.
 */
export async function confirmEventRequestByToken(token: string): Promise<PipelineResult> {
  const request = await getEventRequestByConfirmToken(token);
  if (!request) return { ok: false, reason: "That link does not match a request. Check the link in the email, or reply to it." };
  if (request.state === "declined") return { ok: false, reason: "This request was closed. Reply to the email and we will pick it up again." };
  if (request.state === "requested") return { ok: false, reason: "This request has not been priced yet, so there is nothing to agree to." };
  if (request.state === "paid" || request.state === "confirmed") return { ok: true, request };
  const now = new Date().toISOString();
  return save({ ...request, state: "confirmed", confirmedAt: now, updatedAt: now });
}

/**
 * THE PAYMENT SEAM.
 *
 * Every route to "paid" goes through this one function, and nothing else in the app writes the
 * paid state. Today the only caller is the workspace button a person presses when the money has
 * arrived — method "manual", with whatever reference the bank gave. When a payment provider is
 * wired up, its webhook handler calls this with method "stripe" and the provider's payment id, and
 * NOTHING ELSE CHANGES: the state machine, the instruction send, and the audit trail are already
 * exactly what a provider would drive. That is the whole reason settlement is a parameter rather
 * than an assumption.
 *
 * It does not send anything. The caller does that, so a send is always something a person or a
 * verified webhook set off, never a side effect buried in a state change.
 */
export async function recordSettlement(input: {
  id: string;
  method: SettlementMethod;
  reference?: string;
  settledBy: string;
}): Promise<PipelineResult> {
  const request = await getEventRequest(input.id);
  if (!request) return { ok: false, reason: "That request no longer exists." };
  if (request.state === "paid") return { ok: false, reason: "That request is already marked paid." };
  if (request.state !== "confirmed") return { ok: false, reason: "The client has not confirmed the scope yet. Marking it paid first would send instructions for something nobody agreed to." };
  const now = new Date().toISOString();
  return save({
    ...request,
    state: "paid",
    paidAt: now,
    paidBy: input.settledBy,
    settlementMethod: input.method,
    settlementReference: input.reference?.trim() || undefined,
    updatedAt: now,
  });
}

/** Stamp the fact that the instructions went out. The detail of who got what is in the send log. */
export async function recordInstructionsSent(id: string): Promise<PipelineResult> {
  const request = await getEventRequest(id);
  if (!request) return { ok: false, reason: "That request no longer exists." };
  const now = new Date().toISOString();
  return save({ ...request, instructionsSentAt: now, updatedAt: now });
}
