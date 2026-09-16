import { buildProductionEmailRequest, sendProductionEmail } from "@/services/email/productionEmailService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { howItWorksPath } from "@/services/content/howItWorksService";
import { HOW_IT_WORKS_DEFAULTS } from "@/services/content/howItWorksDefaults";
import { displayCode } from "@/lib/access/accessCodes";
import { HOW_IT_WORKS_AUDIENCES, type HowItWorksAudience } from "@/types/howItWorks";
import { formatPrice, type EventRequestRecord } from "@/types/eventRequest";
import type { EmailSendLog } from "@/types/emailProduction";
import type { EmailWorkflowType } from "@/types/emailWorkflows";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The two sends on the plan-an-event path: the approval the client is sent, and the instructions
 * that go out when the event is paid for.
 *
 * Both write a row to the same send log every other send in this app writes to (migration 0032), so
 * "what did we actually send this client" has one answer. Both are called from a server action a
 * person pressed. Nothing in this file is on a timer and nothing in it sends itself.
 *
 * The instruction emails carry a LINK to /how-it-works/<audience>, never the text of it. That is
 * the difference between fixing an instruction once and re-sending five hundred emails.
 */
export interface InstructionAudience {
  audience: HowItWorksAudience;
  workflow: EmailWorkflowType;
  label: string;
}

export const INSTRUCTION_AUDIENCES: InstructionAudience[] = HOW_IT_WORKS_AUDIENCES.map((audience) => ({
  audience,
  workflow: `instructions_${audience}` as EmailWorkflowType,
  label: HOW_IT_WORKS_DEFAULTS[audience].audienceLabel,
}));

type SentLog = EmailSendLog & { sentBy?: string };

/** One send, one row. The row is written even when the provider is the mock, saying that it was. */
async function sendAndLog(input: {
  workflow: EmailWorkflowType;
  to: string;
  subject: string;
  summary: string;
  actionUrl: string;
  eventId?: string;
  eventName?: string;
  recipientName?: string;
  sentBy: string;
}): Promise<SentLog> {
  const request = buildProductionEmailRequest({
    workflowType: input.workflow,
    to: input.to,
    subject: input.subject,
    eventId: input.eventId,
    eventName: input.eventName,
    recipientName: input.recipientName,
    summary: input.summary,
    actionUrl: input.actionUrl,
  });
  const { log } = await sendProductionEmail(request);
  const row: SentLog = {
    ...log,
    id: `${log.id}-${input.to.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
    eventId: input.eventId,
    sentBy: input.sentBy,
  };
  await getRuntimeStore().appendEmailSendLog(row).catch(() => undefined);
  return row;
}

/**
 * The approval. One link, to the client's own scope page, where they read what we are doing, what
 * it costs, and press the button that says yes.
 */
export async function sendApprovalEmail(input: {
  request: EventRequestRecord;
  baseUrl: string;
  sentBy: string;
}): Promise<SentLog> {
  const { request, baseUrl } = input;
  const link = `${baseUrl}/proposal/${request.confirmToken}`;
  const price = formatPrice(request.priceAmountCents, request.priceCurrency);
  return sendAndLog({
    workflow: "scope_approved",
    to: request.email,
    subject: `Your event with West Peek: scope and price`,
    summary: `We have scoped your event. ${request.scopeSummary} The price is ${price}. Read it in full and confirm here, and we will send you and your people the instructions once it is settled.`,
    actionUrl: link,
    eventId: request.eventId,
    recipientName: request.name,
    sentBy: input.sentBy,
  });
}

export interface InstructionRecipients {
  client: string[];
  crew: string[];
  speaker: string[];
  sponsor: string[];
  attendee: string[];
}

export function emptyInstructionRecipients(): InstructionRecipients {
  return { client: [], crew: [], speaker: [], sponsor: [], attendee: [] };
}

/** What each audience is told, in one line, above the link they are being sent to. */
function instructionSummary(audience: HowItWorksAudience, event: RuntimeEventRecord | undefined, eventName: string) {
  const codeLine = (label: string, code: string | undefined) => (code ? ` Your ${label} is ${displayCode(code)}.` : "");
  switch (audience) {
    case "client":
      return `${eventName} is confirmed and we have started production. This page is what happens next, what we need from you, and by when. We keep it up to date, so read it there rather than saving a copy.`;
    case "crew":
      return `You are running ${eventName} on West Peek Live. This page is everything you need: getting in, the deck, going live, moderation, the fallback ladder, and ending the show.${codeLine("crew code", event?.accessCodes?.crew)}`;
    case "speaker":
      return `You are speaking at ${eventName}. This page covers getting in, the tech check, your cue cards, and what happens when you are brought to the stage.${codeLine("speaker code", event?.accessCodes?.speaker)}`;
    case "sponsor":
      return `You are sponsoring ${eventName}. This page covers setting your booth up, the ready room, and how leads reach you.${codeLine("sponsor code", event?.accessCodes?.sponsor)}`;
    case "attendee":
    default:
      return `You are coming to ${eventName}. This page covers getting in, what is in the venue, and how to ask a question.${event?.joinCode ? ` Your join code is ${displayCode(event.joinCode)}.` : ""}`;
  }
}

export interface InstructionSendResult {
  sent: number;
  failed: number;
  logs: SentLog[];
  /** Audience to the addresses it actually went to, which is what the workspace shows back. */
  byAudience: Record<string, string[]>;
}

/**
 * Send the instructions. One message per address, one row per message, each linking to the page for
 * that audience. Called by the workspace when the event is marked paid, because a person pressed
 * the button; there is no other caller and no schedule.
 */
export async function sendInstructionEmails(input: {
  request: EventRequestRecord;
  event?: RuntimeEventRecord;
  recipients: InstructionRecipients;
  baseUrl: string;
  sentBy: string;
}): Promise<InstructionSendResult> {
  const eventName = input.event?.name || input.request.company || "your event";
  const logs: SentLog[] = [];
  const byAudience: Record<string, string[]> = {};
  let sent = 0;
  let failed = 0;

  for (const entry of INSTRUCTION_AUDIENCES) {
    const addresses = input.recipients[entry.audience] || [];
    if (!addresses.length) continue;
    byAudience[entry.audience] = addresses;
    for (const address of addresses) {
      const row = await sendAndLog({
        workflow: entry.workflow,
        to: address,
        subject: `${eventName}: how it works, for ${entry.audience === "client" ? "you" : entry.audience + "s"}`,
        summary: instructionSummary(entry.audience, input.event, eventName),
        actionUrl: `${input.baseUrl}${howItWorksPath(entry.audience)}`,
        eventId: input.request.eventId,
        eventName,
        sentBy: input.sentBy,
      });
      logs.push(row);
      if (row.status === "failed") failed += 1;
      else sent += 1;
    }
  }

  return { sent, failed, logs, byAudience };
}

/** A list of addresses the way a person types one. Shared with the event email centre's parser. */
export function parseAddressList(raw: string) {
  return Array.from(
    new Set(
      String(raw || "")
        .split(/[\s,;]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.includes("@")),
    ),
  ).slice(0, 500);
}
