import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { emailConfiguration, listAllEmailLog } from "@/services/email/eventEmailService";
import { listEventRecords } from "@/services/events/eventRepository";

/**
 * Every message the app has sent, newest first, grouped by the event it belongs to. The record, and
 * the honest answer to "did that go out?". Sending happens in the panel above, or on the event's
 * own Communications page; both write these rows.
 */
export async function EmailAcrossEvents() {
  const [{ configured, replyTo }, log, events] = await Promise.all([
    emailConfiguration(),
    listAllEmailLog(),
    listEventRecords({ includeArchived: true, includeSeed: false }).catch(() => []),
  ]);
  const names = Object.fromEntries(events.map((event) => [event.id, event.name]));
  const byEvent = new Map<string, typeof log>();
  for (const row of log) {
    const key = row.eventId || "no-event";
    byEvent.set(key, [...(byEvent.get(key) || []), row]);
  }
  const failed = log.filter((row) => row.status === "failed").length;
  return (
    <SectionCard title="Email across events" eyebrow={`${log.length} message${log.length === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""}`}>
      <div data-testid="email-across-events" data-count={log.length} data-configured={configured ? "true" : "false"}>
        <p className={`rounded-2xl p-3 text-sm font-bold ${configured ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} data-testid="email-provider-banner">
          {configured ? `Resend is configured${replyTo ? `; replies go to ${replyTo}` : ""}.` : "Resend is not configured on this deployment: sends are recorded as mock and nothing leaves."}
        </p>
        <p className="mt-2 text-sm text-brand-muted">Nothing here was sent on a timer. Every row is a message a person chose to send, from the panel above or from an event&rsquo;s Communications page.</p>
        {log.length ? (
          <div className="mt-4 space-y-4">
            {Array.from(byEvent.entries()).map(([eventId, rows]) => (
              <div key={eventId} className="rounded-2xl border border-brand-line p-3" data-testid={`email-event-${eventId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{names[eventId] || eventId}<span className="ml-2 text-xs text-brand-muted">{rows.length} message{rows.length === 1 ? "" : "s"}</span></p>
                  {eventId === "no-event" ? null : <Link href={`/app/events/${eventId}/communications`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange">Open communications</Link>}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-brand-muted">
                  {rows.slice(0, 6).map((row) => (
                    <li key={row.id} data-testid={`email-row-${row.id}`}>
                      <strong className="text-brand-black">{row.workflowType.replace(/_/g, " ")}</strong> → {row.recipientEmail} · {row.status}{row.provider === "mock" ? " (mock)" : ""} · <LocalTime iso={row.queuedAt} mode="datetime" />{row.sentBy ? ` · by ${row.sentBy}` : ""}
                    </li>
                  ))}
                  {rows.length > 6 ? <li>…and {rows.length - 6} more.</li> : null}
                </ul>
              </div>
            ))}
          </div>
        ) : <div className="mt-4"><EmptyState title="Nothing has been sent yet" body="Messages appear here the first time someone sends one from an event's Communications page." /></div>}
      </div>
    </SectionCard>
  );
}
