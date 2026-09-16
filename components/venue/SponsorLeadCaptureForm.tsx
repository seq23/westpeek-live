import { submitSponsorLeadAction } from "@/lib/actions/venueRuntimeActions";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";

export async function SponsorLeadCaptureForm({ eventId, boothId }: { eventId: string; boothId: string }) {
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  return (
    <form action={submitSponsorLeadAction} className="rounded-3xl border border-slate-200 bg-white p-5" data-testid="sponsor-lead-opt-in-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="boothId" value={boothId} />
      <h3 className="text-lg font-semibold">Request sponsor follow-up</h3>
      <p className="mt-2 text-sm text-slate-600">Sponsors receive attendee info only after this intentional booth opt-in. Attending the event alone does not share your profile with every sponsor.</p>
      {identity ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Opting in as {identity.displayName} · {identity.company}</p> : <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">Register before sending your attendee profile to this sponsor.</p>}
      <textarea className="mt-3 w-full rounded-xl border border-slate-200 p-3" name="interest" placeholder="What should this sponsor follow up about?" />
      <button className="mt-3 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Share my profile with this sponsor</button>
    </form>
  );
}
