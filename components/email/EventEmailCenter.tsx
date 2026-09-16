import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { sendEventEmailAction } from "@/lib/actions/eventEmailActions";
import { emailConfiguration, lastSendByWorkflow, listEventEmailLog, MANUAL_WORKFLOWS } from "@/services/email/eventEmailService";

/**
 * What this event has sent, and what you can send right now.
 *
 * The old page printed one slogan about Resend under eleven workflow names and knew nothing about
 * any of them. This one reads the send log: per workflow,
 * when it last went out, to whom and whether it landed; and a Send now that mails the addresses
 * you type, once, because you pressed it.
 */
const STATUS_TONE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-900",
  queued: "bg-slate-100 text-slate-700",
  failed: "bg-red-100 text-red-900",
};

export async function EventEmailCenter({ eventId, sent, workflowSent, error }: { eventId: string; sent?: string; workflowSent?: string; error?: string }) {
  const [viewer, { configured, replyTo }, log, latest] = await Promise.all([
    getCrewViewer(eventId),
    emailConfiguration(),
    listEventEmailLog(eventId),
    lastSendByWorkflow(eventId),
  ]);
  return (
    <SectionCard title="Communications" eyebrow={`${log.length} message${log.length === 1 ? "" : "s"} sent for this event`}>
      <div data-testid="event-email-center" data-configured={configured ? "true" : "false"} data-sent-count={log.length}>
        <p className={`rounded-2xl p-3 text-sm font-bold ${configured ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} data-testid="email-provider-banner">
          {configured
            ? `Email is live through Resend${replyTo ? `, replies go to ${replyTo}` : ""}. Anything you send below really leaves the building.`
            : "Resend is not configured on this deployment, so nothing actually leaves: sends are recorded as mock so you can see the flow without mailing anyone."}
        </p>
        {sent ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="email-sent-note">Sent {sent} {workflowSent ? `${workflowSent.replace(/_/g, " ")} ` : ""}message{sent === "1" ? "" : "s"}.</p> : null}
        {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-900" data-testid="email-error-note">{error}</p> : null}
        <DeniedNote viewer={viewer} action="manage_access_codes" className="mt-3" />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {MANUAL_WORKFLOWS.map((entry) => {
            const last = latest.get(entry.workflow);
            return (
              <div key={entry.workflow} className="rounded-2xl border border-brand-line p-3" data-testid={`email-workflow-${entry.workflow}`} data-last={last?.status || "never"}>
                <p className="font-black text-brand-black">{entry.label}</p>
                <p className="text-xs text-brand-muted">{entry.whoItIsFor} · {entry.gist}</p>
                <p className="mt-1 text-xs" data-testid={`email-last-${entry.workflow}`}>
                  {last ? <>Last sent to <strong>{last.recipientEmail}</strong> · <LocalTime iso={last.queuedAt} mode="datetime" /> · {last.status}{last.provider === "mock" ? " (mock)" : ""}</> : <span className="text-brand-muted">Never sent for this event.</span>}
                </p>
                <GatedForm viewer={viewer} action="manage_access_codes" formAction={sendEventEmailAction} className="mt-2 space-y-2">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="workflow" value={entry.workflow} />
                  <input name="recipients" placeholder="name@example.com, another@example.com" className="w-full rounded-xl border border-brand-line px-2 py-1 text-xs" data-testid={`email-recipients-${entry.workflow}`} />
                  <input name="message" placeholder="One line of your own (optional)" className="w-full rounded-xl border border-brand-line px-2 py-1 text-xs" data-testid={`email-message-${entry.workflow}`} />
                  <button className="rounded-full bg-brand-black px-3 py-1 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid={`email-send-${entry.workflow}`}>Send now</button>
                </GatedForm>
              </div>
            );
          })}
        </div>

        <div className="mt-6" data-testid="email-log">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-muted">What has gone out</p>
          {log.length ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] font-black uppercase tracking-wide text-brand-muted"><tr><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Workflow</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3">Status</th><th className="py-2">Sent by</th></tr></thead>
                <tbody>
                  {log.slice(0, 50).map((row) => (
                    <tr key={row.id} className="border-t border-brand-line" data-testid={`email-log-row-${row.id}`}>
                      <td className="py-2 pr-3 text-xs"><LocalTime iso={row.queuedAt} mode="datetime" /></td>
                      <td className="py-2 pr-3 text-xs">{row.workflowType.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-3 text-xs">{row.recipientEmail}</td>
                      <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[row.status] || "bg-slate-100"}`}>{row.status}{row.provider === "mock" ? " · mock" : ""}</span>{row.failureReason ? <span className="ml-2 text-[11px] text-red-800">{row.failureReason}</span> : null}</td>
                      <td className="py-2 text-xs text-brand-muted">{row.sentBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="mt-2"><EmptyState title="Nothing sent yet" body="Every message this event sends appears here with who it went to and whether it landed." /></div>}
        </div>
      </div>
    </SectionCard>
  );
}
