import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { sendEventEmailAction } from "@/lib/actions/eventEmailActions";
import { emailConfiguration, MANUAL_WORKFLOWS } from "@/services/email/eventEmailService";
import { listEventRecords } from "@/services/events/eventRepository";

/**
 * Send, from the Email tab.
 *
 * The Email tab could only send a test. The real sending lived on each event's Communications page,
 * so the one page called "Email" was the one place you could not email anybody. This picks the
 * event, the message and the people, and then posts to the SAME server action the event page posts
 * to — same guard, same service, same log row. There is no second send path here to drift out of
 * step with the first.
 */
export async function CrossEventSendPanel({ sent, workflowSent, error }: { sent?: string; workflowSent?: string; error?: string } = {}) {
  const [{ configured, replyTo }, events] = await Promise.all([
    emailConfiguration(),
    listEventRecords({ includeArchived: false, includeSeed: false }).catch(() => []),
  ]);
  return (
    <SectionCard title="Send an email" eyebrow="Pick the event, pick the message, pick who gets it">
      <div data-testid="cross-event-send" data-events={events.length} data-configured={configured ? "true" : "false"}>
        <p className={`rounded-2xl p-3 text-sm font-bold ${configured ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} data-testid="cross-event-send-banner">
          {configured
            ? `Live through Resend${replyTo ? `, replies go to ${replyTo}` : ""}. What you send here really leaves the building.`
            : "Resend is not configured on this deployment, so nothing actually leaves: the send is recorded as mock so you can see the flow without mailing anyone."}
        </p>
        {sent ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="cross-event-sent-note">Sent {sent} {workflowSent ? `${workflowSent.replace(/_/g, " ")} ` : ""}message{sent === "1" ? "" : "s"}.</p> : null}
        {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-900" data-testid="cross-event-send-error">{error}</p> : null}

        {events.length ? (
          <form action={sendEventEmailAction} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="cross-event-send-form">
            <input type="hidden" name="returnTo" value="/app/email" />
            <label className="text-sm font-black">
              Event
              <select name="eventId" required className="mt-1 min-h-12 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="cross-event-event">
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-black">
              Message
              <select name="workflow" required defaultValue="client_invite" className="mt-1 min-h-12 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="cross-event-workflow">
                {MANUAL_WORKFLOWS.map((entry) => <option key={entry.workflow} value={entry.workflow}>{entry.label} — {entry.whoItIsFor.toLowerCase()}</option>)}
              </select>
            </label>
            <label className="text-sm font-black md:col-span-2">
              Who gets it
              <input name="recipients" required placeholder="name@example.com, another@example.com" className="mt-1 min-h-12 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="cross-event-recipients" />
              <span className="mt-1 block text-xs font-normal text-brand-muted">Commas, spaces or new lines. Each address gets its own message and its own row in the log below.</span>
            </label>
            <label className="text-sm font-black md:col-span-2">
              One line of your own (optional)
              <input name="message" placeholder="Rehearsal moved to Thursday at 2." className="mt-1 min-h-12 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="cross-event-message" />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white hover:bg-brand-orange" data-testid="cross-event-send-submit">Send now</button>
              <p className="mt-2 text-xs text-brand-muted">Nothing goes out on a timer. This sends once, now, because you pressed it.</p>
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <EmptyState title="No events to send for" body="A message belongs to an event: it carries that event's name and its link. Create one first and it appears here." />
            <Link href="/app/events/new" className="mt-3 inline-flex rounded-full bg-brand-black px-5 py-2 text-sm font-bold text-white hover:bg-brand-orange" data-testid="cross-event-send-create-event">Create an event</Link>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
