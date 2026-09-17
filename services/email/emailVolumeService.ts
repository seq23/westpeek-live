import { listAllEmailLog } from "./eventEmailService";
import type { EmailSendLog } from "@/types/emailProduction";

/**
 * How much of the month's email the owner has already spent.
 *
 * The plan behind this deployment allows roughly 3,000 messages a month and 100 a day. Resend
 * publishes no usage endpoint we can read, so this counts OUR OWN log rows and the UI says exactly
 * that rather than printing a number it cannot stand behind. The count is therefore a floor: a
 * message sent through Resend by anything other than this app is not in it.
 *
 * The daily allowance is a REFUSAL, not a warning. Half-sending a 47-person announcement — thirty
 * delivered, seventeen silently dropped at the provider — is the outcome this guard exists to
 * prevent, because there is no way to tell afterwards who got it.
 */
export const RESEND_DAILY_ALLOWANCE = 100;
export const RESEND_MONTHLY_ALLOWANCE = 3000;

/** What we are counting, in the words the Email tab prints under the number. */
export const VOLUME_SOURCE_NOTE = "Counted from this app's own send log, not from Resend: Resend publishes no usage figure we can read. A message sent through Resend from anywhere else is not in this count.";

function dayKey(iso: string) {
  return String(iso || "").slice(0, 10);
}

function monthKey(iso: string) {
  return String(iso || "").slice(0, 7);
}

export interface EmailVolume {
  today: number;
  month: number;
  dailyAllowance: number;
  monthlyAllowance: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  countedFrom: "own_log";
  note: string;
}

/** A mock-provider row never left the building, so it never counts against a real allowance. */
function billable(row: EmailSendLog) {
  return row.provider === "resend" && row.status !== "failed";
}

export async function emailVolume(now = new Date()): Promise<EmailVolume> {
  const rows = await listAllEmailLog(5000);
  const today = dayKey(now.toISOString());
  const month = monthKey(now.toISOString());
  const sentToday = rows.filter((row) => billable(row) && dayKey(row.queuedAt) === today).length;
  const sentThisMonth = rows.filter((row) => billable(row) && monthKey(row.queuedAt) === month).length;
  return {
    today: sentToday,
    month: sentThisMonth,
    dailyAllowance: RESEND_DAILY_ALLOWANCE,
    monthlyAllowance: RESEND_MONTHLY_ALLOWANCE,
    dailyRemaining: Math.max(0, RESEND_DAILY_ALLOWANCE - sentToday),
    monthlyRemaining: Math.max(0, RESEND_MONTHLY_ALLOWANCE - sentThisMonth),
    countedFrom: "own_log",
    note: VOLUME_SOURCE_NOTE,
  };
}

export interface VolumeVerdict {
  ok: boolean;
  reason?: string;
  volume: EmailVolume;
}

/**
 * Asked before a send, never after. A send that would cross the daily line is refused whole: the
 * answer names the number of people, the remaining allowance and tomorrow, so the sender has
 * something to do rather than a red box.
 */
export async function checkSendAllowance(recipientCount: number, now = new Date()): Promise<VolumeVerdict> {
  const volume = await emailVolume(now);
  if (recipientCount > volume.dailyRemaining) {
    return {
      ok: false,
      volume,
      reason: `That is ${recipientCount} message${recipientCount === 1 ? "" : "s"} and only ${volume.dailyRemaining} of today's ${volume.dailyAllowance} are left (${volume.today} already sent). Nothing has been sent — send it tomorrow, or send to a smaller group today.`,
    };
  }
  if (recipientCount > volume.monthlyRemaining) {
    return {
      ok: false,
      volume,
      reason: `That is ${recipientCount} message${recipientCount === 1 ? "" : "s"} and only ${volume.monthlyRemaining} of this month's ${volume.monthlyAllowance} are left (${volume.month} already sent). Nothing has been sent.`,
    };
  }
  return { ok: true, volume };
}
