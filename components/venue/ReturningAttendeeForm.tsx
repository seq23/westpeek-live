import { restoreRegistrationOnThisDeviceAction } from "@/lib/actions/attendeeReturnActions";

/**
 * One field. Somebody who has already registered for this event types the address they used and
 * this device picks their registration up; a miss lands on the registration form with the address
 * filled in, so it never says who is or is not on the list.
 */
export function ReturningAttendeeForm({ eventId, slug, heading, help, defaultEmail = "", waitSeconds, testId = "returning-attendee-form" }: { eventId: string; slug: string; heading: string; help: string; defaultEmail?: string; waitSeconds?: number; testId?: string }) {
  return (
    <form action={restoreRegistrationOnThisDeviceAction} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={testId}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm font-semibold text-slate-900">{heading}</p>
      <p className="mt-1 text-sm text-slate-600">{help}</p>
      {waitSeconds ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="returning-attendee-wait">That is a lot of tries in a row. Wait {waitSeconds} seconds and try once more, or just register again below.</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${testId}-email`} className="sr-only">Email you registered with</label>
        <input id={`${testId}-email`} name="email" type="email" required defaultValue={defaultEmail} placeholder="you@company.com" autoComplete="email" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand-orange" data-testid="returning-attendee-email" />
        <button type="submit" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white sm:w-auto" data-testid="returning-attendee-submit">Bring my registration back</button>
      </div>
    </form>
  );
}
