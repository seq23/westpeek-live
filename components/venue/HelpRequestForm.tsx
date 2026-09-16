import { submitHelpRequestAction } from "@/lib/actions/venueRuntimeActions";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";

export async function HelpRequestForm({ eventId, topics }: { eventId: string; topics: string[] }) {
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  return (
    <form action={submitHelpRequestAction} className="rounded-3xl bg-white p-6" data-testid="attendee-help-request-form">
      <input type="hidden" name="eventId" value={eventId} />
      <h3 className="text-xl font-semibold">Ask for help</h3>
      <p className="mt-2 text-sm text-slate-500">Submitting this form creates a runtime support event and analytics event tied to your event-scoped attendee identity when registered.</p>
      {identity ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Requesting help as {identity.displayName} · {identity.company}</p> : <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">Register first if you want support tied to your attendee profile.</p>}
      <div className="mt-4 grid gap-3">
        <select className="rounded-xl border border-slate-200 p-3" name="topic" defaultValue={topics[0]}>
          {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
        </select>
        <input required className="rounded-xl border border-slate-200 p-3" name="subject" aria-label="Subject" />
        <textarea required className="rounded-xl border border-slate-200 p-3" name="message" aria-label="Message" />
        <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Send help request</button>
      </div>
    </form>
  );
}
