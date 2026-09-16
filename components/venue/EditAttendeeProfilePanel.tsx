import { updateAttendeeProfileAction } from "@/lib/actions/attendeeProfileActions";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { findEventRecord } from "@/services/events/eventRepository";
import { answerFor, questionsForEvent, tellUsMoreProgressFor } from "@/services/attendees/registrationQuestions";
import { VenueSection } from "@/components/venue/VenueSection";

/**
 * "Tell us more about you" — everything registration no longer asks, in one collapsed section that
 * runs the full width of the page. It used to sit in the 24rem chat rail, where a seven-field form
 * clipped a website to "https://www.spryvc.c" and wrapped a social link mid-URL, and where it
 * overflowed the grid row onto My Agenda (the owner, 16 Sep 2026). Each field is optional; one
 * small form saves them all through the single profile write path; a "N of 7" cue shows progress.
 * The "Hide me from the People directory" switch lives here too.
 */
export async function EditAttendeeProfilePanel({ eventId, returnTo, saved = false, open }: { eventId: string; returnTo?: string; saved?: boolean; open?: boolean }) {
  const profile = await getCurrentAttendeeProfile(eventId);
  if (!profile) return null;
  // The event's own question list (or the default four), rendered from event config — never a literal list.
  const event = await findEventRecord(eventId).catch(() => undefined);
  const questions = questionsForEvent(event);
  const progress = tellUsMoreProgressFor(profile, questions);
  const complete = progress.filled === progress.total;
  return (
    <VenueSection
      id="tell-us-more"
      storageKey={`tell-us-more-${eventId}`}
      testId="attendee-profile-panel"
      eyebrow="Your profile"
      title="Tell us more about you"
      summary={complete ? "All filled in. Change it any time." : "Fill this in and the People page and networking work better for you."}
      badge={<span className="rounded-full bg-brand-orangeSoft px-2 py-0.5 text-[11px] font-black text-brand-orange" data-testid="tell-us-more-progress">{progress.filled} of {progress.total}</span>}
      defaultOpen={open ?? saved}
    >
      <div data-progress={`${progress.filled}/${progress.total}`} data-question-count={questions.length}>
        <p className="text-xs text-slate-500">{profile.name} · {profile.company}{profile.title ? ` · ${profile.title}` : ""}. Everything here is optional, it is only used at this event, and none of it changes what you can get into.</p>
        {saved ? <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm font-bold text-emerald-900" data-testid="tell-us-more-saved">Saved.</p> : null}
        <form action={updateAttendeeProfileAction} className="mt-3 grid gap-3" data-testid="edit-attendee-profile-form">
          <input type="hidden" name="eventId" value={eventId} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <input type="hidden" name="hasHiddenFromDirectory" value="1" /><input type="hidden" name="hasNetworkingOptIn" value="1" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-bold text-slate-600">Title / role<input name="title" defaultValue={profile.title} placeholder="Founder" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="tell-title" /></label>
            <label className="text-xs font-bold text-slate-600">Website<input name="personalWebsite" defaultValue={profile.personalWebsite || ""} placeholder="mysite.com, no https:// needed" inputMode="url" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="tell-website" /></label>
            <label className="text-xs font-bold text-slate-600">Social links<textarea name="socialLinks" defaultValue={(profile.socialLinks || []).join("\n")} placeholder="LinkedIn, X. One per line." className="mt-1 w-full break-all rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="tell-social" /></label>
            {questions.map((question) => {
              const value = answerFor(profile, question);
              const testId = question.key === "reasonForAttending" ? "tell-reason" : question.key === "interestingFact" ? "tell-fact" : question.key === "topicsOfInterest" ? "tell-topics" : question.key === "networkingGoals" ? "tell-goals" : `tell-answer-${question.key}`;
              const placeholder = question.type === "tags" ? "One per line" : question.key === "networkingGoals" ? "Who do you want to meet, and why?" : "";
              return (
                <label key={question.key} className={`text-xs font-bold text-slate-600 ${question.type === "textarea" ? "sm:col-span-2 xl:col-span-1" : ""}`}>
                  {question.label}
                  {question.type === "text" ? <input name={`answer:${question.key}`} defaultValue={value} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid={testId} /> : <textarea name={`answer:${question.key}`} defaultValue={value} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid={testId} />}
                </label>
              );
            })}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" name="hiddenFromDirectory" defaultChecked={Boolean(profile.hiddenFromDirectory)} className="mt-1" data-testid="tell-hide-me" /><span><strong>Hide me from the People directory.</strong><br /><span className="text-xs text-slate-500">Crew can still see you; networking still works if you join the queue. Sponsors won&rsquo;t see you in their lead views.</span></span></label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="networkingOptIn" defaultChecked={profile.networkingOptIn} /> Include me in speed networking suggestions.</label>
          <div><button className="min-h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="tell-us-more-save">Save</button></div>
        </form>
      </div>
    </VenueSection>
  );
}
