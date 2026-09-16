import { getAttendeeSessionStanding } from "@/services/attendees/attendeeSessionService";
import { SECOND_DEVICE_WORDS, dayWord, registeredForWords, remainingWords } from "@/services/attendees/attendeeSessionPolicy";
import { ReturningAttendeeForm } from "@/components/venue/ReturningAttendeeForm";

/**
 * The answer to "do i have to register again when i come back, how long does my registration last
 * if i exit?" It is a quiet line in the identity area, not a toast that vanishes before it is read,
 * and it says the same thing on a phone as on a laptop because the rule is the same: this browser,
 * for this many days.
 *
 * The number comes from the event's configured lifetime, never from a sentence with 14 typed into it.
 */
export async function RegistrationContinuityNote({ eventId, slug, justReturned = false }: { eventId: string; slug?: string; justReturned?: boolean }) {
  const standing = await getAttendeeSessionStanding(eventId);
  if (standing.state === "none") return null;
  const returnSlug = slug || eventId;

  if (standing.state === "active") {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" data-testid="registration-continuity" data-continuity-state="active" data-continuity-days={standing.days}>
        {justReturned ? "Welcome back. " : ""}
        {registeredForWords(standing.days)} You do not have to register again if you close the tab or leave and come back. {SECOND_DEVICE_WORDS}
      </p>
    );
  }

  const heading = standing.state === "expiring" ? "Keep this device registered" : "Pick your registration back up";
  const help = standing.state === "expiring"
    ? `Your registration on this device runs out ${remainingWords(standing.msLeft || 0)}. Enter the email you registered with and it starts again for ${dayWord(standing.days)}.`
    : `Your registration on this device has run out. Enter the email you registered with and your name, company and answers come back. Nothing to fill in twice.`;

  return (
    <div className="space-y-2" data-testid="registration-continuity" data-continuity-state={standing.state} data-continuity-days={standing.days}>
      <ReturningAttendeeForm eventId={eventId} slug={returnSlug} heading={heading} help={help} testId="registration-continuity-form" />
    </div>
  );
}
