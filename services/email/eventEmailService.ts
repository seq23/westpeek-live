import { isResendConfigured } from "@/lib/env";
import { getHouseDefaults } from "@/services/agencies/houseDefaultsService";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { findEventRecord } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { buildProductionEmailRequest, sendProductionEmail } from "./productionEmailService";
import type { EmailSendLog } from "@/types/emailProduction";
import type { EmailWorkflowType } from "@/types/emailWorkflows";

/**
 * What this event has actually sent, and what the crew can send by hand.
 *
 * The Email page used to print "Live-send capable through Resend." under eleven workflow names and
 * know nothing. Now every send writes a row, the page shows the real last-send per workflow, and a
 * send only ever happens because a crew member pressed the button — nothing reaches an attendee on
 * a timer.
 */
export interface ManualWorkflow {
  workflow: EmailWorkflowType;
  label: string;
  whoItIsFor: string;
  /** What the message says, in one line, so nobody sends a mystery. */
  gist: string;
}

export const MANUAL_WORKFLOWS: ManualWorkflow[] = [
  { workflow: "speaker_invite", label: "Speaker invite", whoItIsFor: "A speaker", gist: "Their green room link and what to do before the show." },
  { workflow: "sponsor_setup_invite", label: "Sponsor setup", whoItIsFor: "A sponsor", gist: "Their booth link and what to fill in." },
  { workflow: "client_invite", label: "Client invite", whoItIsFor: "The client", gist: "Their read-only portal for this event." },
  { workflow: "tech_check_reminder", label: "Tech check reminder", whoItIsFor: "A speaker", gist: "A nudge to run the tech check before show day." },
  { workflow: "asset_deadline_reminder", label: "Asset reminder", whoItIsFor: "A speaker or sponsor", gist: "A nudge to send the deck or the logo." },
  { workflow: "show_day_reminder", label: "Show day reminder", whoItIsFor: "Anyone you name", gist: "When it starts and how to get in." },
  { workflow: "report_ready", label: "Report ready", whoItIsFor: "The client", gist: "The event report is ready to read." },
  { workflow: "crew_call_sheet", label: "Crew call sheet", whoItIsFor: "The crew", gist: "Who is on, when they are on, and where to be." },
];

export function isManualWorkflow(workflow: string): workflow is EmailWorkflowType {
  return MANUAL_WORKFLOWS.some((entry) => entry.workflow === workflow);
}

export async function emailConfiguration() {
  let configured = false;
  try {
    configured = isResendConfigured();
  } catch {
    configured = false;
  }
  // The reply-to the banner prints is the one a message will really carry: the house setting, which
  // falls back to EMAIL_REPLY_TO. Printing the env value while sending from the setting would be a
  // page telling the owner something it does not do.
  const house = await getHouseDefaults().catch(() => undefined);
  return { configured, replyTo: house?.replyToEmail || undefined, fromEmail: house?.fromEmail || undefined };
}

export async function listEventEmailLog(eventId: string, limit = 200) {
  return getRuntimeStore().listEmailSendLogs(eventId, limit).catch(() => [] as Array<EmailSendLog & { sentBy?: string }>);
}

export async function listAllEmailLog(limit = 500) {
  return getRuntimeStore().listAllEmailSendLogs(limit).catch(() => [] as Array<EmailSendLog & { sentBy?: string }>);
}

/** The last thing each workflow sent for this event: what the page shows instead of a slogan. */
export async function lastSendByWorkflow(eventId: string) {
  const rows = await listEventEmailLog(eventId, 500);
  const latest = new Map<string, EmailSendLog & { sentBy?: string }>();
  for (const row of rows) if (!latest.has(row.workflowType)) latest.set(row.workflowType, row);
  return latest;
}

export function parseRecipients(raw: string) {
  return Array.from(new Set(String(raw || "").split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.includes("@")))).slice(0, 200);
}

export interface SendManualResult {
  ok: boolean;
  sent: number;
  failed: number;
  reason?: string;
  logs: Array<EmailSendLog & { sentBy?: string }>;
}

/**
 * One crew click, one send, one row each. When Resend is not configured the provider is the mock —
 * the rows still say exactly that, so nobody believes a message left the building when it did not.
 */
export async function sendManualWorkflow(input: {
  eventId: string;
  workflow: EmailWorkflowType;
  recipients: string[];
  message?: string;
  sentBy: string;
}): Promise<SendManualResult> {
  if (!isManualWorkflow(input.workflow)) return { ok: false, sent: 0, failed: 0, reason: "That workflow is not one a person sends by hand.", logs: [] };
  if (!input.recipients.length) return { ok: false, sent: 0, failed: 0, reason: "Nobody was addressed: put at least one email address in.", logs: [] };
  const event = await findEventRecord(input.eventId);
  const base = await appBaseUrl();
  const store = getRuntimeStore();
  const logs: Array<EmailSendLog & { sentBy?: string }> = [];
  let sent = 0;
  let failed = 0;
  for (const recipient of input.recipients) {
    const request = buildProductionEmailRequest({
      workflowType: input.workflow,
      to: recipient,
      subject: "",
      eventId: input.eventId,
      eventName: event?.name,
      summary: input.message?.trim() || MANUAL_WORKFLOWS.find((entry) => entry.workflow === input.workflow)?.gist,
      actionUrl: `${base}/events/${input.eventId}`,
    });
    const { log } = await sendProductionEmail(request);
    const row = { ...log, id: `${log.id}-${recipient.replace(/[^a-z0-9]/g, "").slice(0, 12)}`, eventId: input.eventId, sentBy: input.sentBy };
    await store.appendEmailSendLog(row).catch(() => undefined);
    logs.push(row);
    if (row.status === "failed") failed += 1; else sent += 1;
  }
  return { ok: failed === 0, sent, failed, logs };
}
