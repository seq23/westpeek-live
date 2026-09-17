import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { randomId } from "@/lib/security/portableCrypto";
import { findEventRecord } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { describeAudience, resolveAudience } from "./emailAudienceService";
import { checkSendAllowance } from "./emailVolumeService";
import { MANUAL_WORKFLOWS, isManualWorkflow } from "./eventEmailService";
import { buildProductionEmailRequest, sendProductionEmail } from "./productionEmailService";
import { unsubscribeUrl } from "./emailSuppressionService";
import { audienceOption, type EmailAudienceKind, type EmailGroupSend, type ResolvedAudience } from "@/types/emailAudience";
import type { EmailSendLog } from "@/types/emailProduction";
import type { EmailWorkflowType } from "@/types/emailWorkflows";

/**
 * Sending to a group, once, because a person pressed the button.
 *
 * Everything the composer promises is enforced here rather than in the page, so a crafted request
 * gets the same answers the screen shows:
 *
 *   · the audience is re-resolved at send time and refused when it is empty;
 *   · the count the sender confirmed must still be the count we resolve, or nothing is sent;
 *   · the daily allowance is checked BEFORE the first message, and a send that would cross it is
 *     refused whole rather than half-delivered;
 *   · every group message carries a signed unsubscribe link and the List-Unsubscribe pair;
 *   · every recipient gets one log row carrying the group id, and the group gets one summary row.
 *
 * Nothing in this file runs on a timer, a cron, or a queue. There is one exported send function and
 * its only caller is a server action behind a button.
 */
export interface GroupSendInput {
  eventId?: string;
  audience: EmailAudienceKind;
  /** The address for the "One person" audience; ignored by every other audience. */
  oneOff?: string;
  /** One of the seven existing templates, or undefined when the sender wrote their own. */
  workflow?: EmailWorkflowType;
  /** Written-from-scratch subject and body. Required when `workflow` is absent. */
  subject?: string;
  body?: string;
  /**
   * What the composer told the sender they were about to email. A mismatch means somebody
   * registered, unsubscribed or was added between the confirm and the press: the send is refused
   * and the sender re-reads the new number rather than mailing a group they never saw.
   */
  expectedCount?: number;
  sentBy: string;
}

export interface GroupSendResult {
  ok: boolean;
  reason?: string;
  sent: number;
  failed: number;
  groupSend?: EmailGroupSend;
  audience?: ResolvedAudience;
}

/**
 * The one line that makes a group message legal and survivable, in both the HTML and the text part.
 * A transactional send never gets this — `sendGroupEmail` is the only function that calls it.
 */
function unsubscribeFooterHtml(url: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin-top:16px;color:#73706a;font-size:12px;line-height:1.5;">
      <p style="margin:0;">You are getting this because you are on the list for this West Peek Live! event.</p>
      <p style="margin:6px 0 0;"><a href="${url}" style="color:#73706a;">Unsubscribe from West Peek Live! announcements</a>. This stops announcements for every event; anything addressed to you personally still reaches you.</p>
    </div>
  `;
}

function unsubscribeFooterText(url: string) {
  return `\n\n—\nYou are getting this because you are on the list for this West Peek Live! event.\nUnsubscribe from announcements (every event): ${url}\nAnything addressed to you personally still reaches you.`;
}

/** The workflow a send is recorded as: the chosen template, or the audience's instructions_* label. */
function workflowFor(input: GroupSendInput): EmailWorkflowType {
  if (input.workflow && isManualWorkflow(input.workflow)) return input.workflow;
  return audienceOption(input.audience)?.customWorkflow ?? "instructions_attendee";
}

export function templateChoices() {
  return MANUAL_WORKFLOWS;
}

export async function sendGroupEmail(input: GroupSendInput): Promise<GroupSendResult> {
  const option = audienceOption(input.audience);
  if (!option) return { ok: false, sent: 0, failed: 0, reason: "That is not an audience this composer knows." };

  const usingTemplate = Boolean(input.workflow);
  const subject = String(input.subject || "").trim();
  const body = String(input.body || "").trim();
  if (usingTemplate && !isManualWorkflow(input.workflow as string)) {
    return { ok: false, sent: 0, failed: 0, reason: "That workflow is not one a person sends by hand." };
  }
  if (!usingTemplate && (!subject || !body)) {
    return { ok: false, sent: 0, failed: 0, reason: "A message of your own needs both a subject and something to say." };
  }

  const audience = await resolveAudience({ kind: input.audience, eventId: input.eventId, oneOff: input.oneOff });
  if (!audience.ok) return { ok: false, sent: 0, failed: 0, reason: audience.reason, audience };

  if (typeof input.expectedCount === "number" && input.expectedCount !== audience.members.length) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      audience,
      reason: `This audience changed while you were writing: it was ${input.expectedCount} ${input.expectedCount === 1 ? "person" : "people"} and it is now ${audience.members.length}. Nothing was sent — read the new list and press Send again.`,
    };
  }

  const allowance = await checkSendAllowance(audience.members.length);
  if (!allowance.ok) return { ok: false, sent: 0, failed: 0, reason: allowance.reason, audience };

  const event = input.eventId ? await findEventRecord(input.eventId).catch(() => undefined) : undefined;
  const base = await appBaseUrl();
  const store = getRuntimeStore();
  const workflowType = workflowFor(input);
  // "One person" is a message addressed to somebody by name: transactional, so no unsubscribe
  // footer, no List-Unsubscribe header, and the suppression list never applied to it upstream.
  const isGroup = input.audience !== "one_person";
  const groupSendId = randomId("email-group");
  const now = new Date().toISOString();

  let sent = 0;
  let failed = 0;
  for (const member of audience.members) {
    const request = buildProductionEmailRequest({
      workflowType,
      to: member.email,
      recipientName: member.name,
      // Blank on a template send means "use the template's own subject": buildEmailSubject derives it.
      subject,
      eventId: input.eventId,
      eventName: event?.name,
      summary: usingTemplate ? (body || MANUAL_WORKFLOWS.find((entry) => entry.workflow === workflowType)?.gist) : body,
      actionUrl: input.eventId ? `${base}/events/${input.eventId}` : undefined,
    });
    if (isGroup) {
      const url = await unsubscribeUrl(base, member.email);
      request.html = `${request.html}${unsubscribeFooterHtml(url)}`;
      request.text = `${request.text}${unsubscribeFooterText(url)}`;
      // Gmail and Apple Mail show their own one-tap control off these two headers. Without the
      // -Post header the client falls back to the mailto/link and most of them hide the control.
      request.headers = { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
    }
    const { log } = await sendProductionEmail(request);
    const row: EmailSendLog & { sentBy?: string } = {
      ...log,
      id: `${groupSendId}-${sent + failed}`,
      eventId: input.eventId,
      recipientName: member.name,
      groupSendId: isGroup ? groupSendId : undefined,
      sentBy: input.sentBy,
    };
    await store.appendEmailSendLog(row).catch(() => undefined);
    if (row.status === "failed") failed += 1;
    else sent += 1;
  }

  const groupSend: EmailGroupSend = {
    id: groupSendId,
    eventId: input.eventId,
    audience: input.audience,
    audienceLabel: describeAudience(audience),
    workflowType,
    subject: subject || audience.label,
    recipientCount: audience.members.length,
    sentCount: sent,
    failedCount: failed,
    suppressedCount: audience.suppressed.length,
    sentBy: input.sentBy,
    createdAt: now,
  };
  // One summary row per send, so 47 messages are one line on the Email page that expands.
  if (isGroup) await store.appendEmailGroupSend(groupSend).catch(() => undefined);

  return { ok: failed === 0, sent, failed, groupSend, audience };
}

/** The Email page's grouped view: each group send with the rows it produced. */
export async function listGroupSends(limit = 100) {
  return getRuntimeStore().listEmailGroupSends(limit).catch(() => [] as EmailGroupSend[]);
}
