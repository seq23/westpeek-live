import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { listGroupSends } from "@/services/email/groupEmailService";
import { listAllEmailLog } from "@/services/email/eventEmailService";
import { emailVolume } from "@/services/email/emailVolumeService";

/**
 * Group email on the Email tab: this month's volume, and every group send as ONE line that expands.
 *
 * The per-recipient rows already exist in the send log and stay there — a 47-person announcement
 * writes 47 of them and they are the record of what went where. What this adds is the summary above
 * them, because 47 unexplained lines is not a thing anybody can read.
 *
 * The volume figure is counted from our own log rows and the panel says so out loud. Resend
 * publishes no usage number we can read, and printing one we cannot stand behind is worse than
 * printing the one we can.
 */
export async function GroupEmailOverview() {
  const [volume, groups, log] = await Promise.all([emailVolume(), listGroupSends(50), listAllEmailLog(2000)]);
  const rowsByGroup = new Map<string, typeof log>();
  for (const row of log) {
    if (!row.groupSendId) continue;
    rowsByGroup.set(row.groupSendId, [...(rowsByGroup.get(row.groupSendId) || []), row]);
  }
  const monthPercent = Math.min(100, Math.round((volume.month / volume.monthlyAllowance) * 100));

  return (
    <SectionCard title="Group email" eyebrow="This month's volume, and what went out to a group">
      <div data-testid="group-email-overview" data-month={volume.month} data-today={volume.today}>
        <div className="rounded-2xl bg-slate-50 p-4" data-testid="email-volume">
          <p className="text-sm font-black text-slate-950">
            {volume.month} of about {volume.monthlyAllowance} this month · {volume.today} of {volume.dailyAllowance} today
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-orange" style={{ width: `${monthPercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500" data-testid="email-volume-note">{volume.note}</p>
        </div>

        <p className="mt-4">
          <Link href="/app/email/compose" className="rounded-full bg-brand-black px-4 py-2 text-sm font-black text-white hover:bg-brand-orange" data-testid="email-compose-link">
            Write to a group
          </Link>
        </p>

        <div className="mt-5" data-testid="group-send-list">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-muted">Group sends</p>
          {groups.length ? (
            <ul className="mt-2 grid gap-2">
              {groups.map((group) => {
                const rows = rowsByGroup.get(group.id) || [];
                return (
                  <li key={group.id} className="rounded-2xl border border-brand-line p-3" data-testid={`group-send-${group.id}`}>
                    <details>
                      <summary className="cursor-pointer text-sm font-bold text-slate-950">
                        {group.subject || group.audienceLabel} · {group.sentCount} sent{group.failedCount ? ` · ${group.failedCount} failed` : ""}{group.suppressedCount ? ` · ${group.suppressedCount} unsubscribed` : ""} · <LocalTime iso={group.createdAt} mode="datetime" />
                      </summary>
                      <p className="mt-1 text-xs text-brand-muted">{group.audienceLabel} · sent by {group.sentBy || "—"}</p>
                      <ul className="mt-2 grid gap-1 text-xs text-slate-700">
                        {rows.map((row) => <li key={row.id}>{row.recipientEmail} · {row.status}{row.provider === "mock" ? " (mock)" : ""}{row.failureReason ? ` · ${row.failureReason}` : ""}</li>)}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2"><EmptyState title="No group sends yet" body="Every message sent to attendees, VIPs, speakers, sponsors, crew or the client appears here as one line that opens into who got it." /></div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
