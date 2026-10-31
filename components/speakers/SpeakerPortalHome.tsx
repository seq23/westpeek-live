import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { getSpeakerCueDeck, getSpeakerStageState, getSpeakerTechCheck } from "@/services/guests/guestStateService";
import type { SpecialGuestProfile } from "@/types/specialGuest";
import { withViewAs } from "@/lib/auth/viewAsGuard";
import { getEventShow, segmentsForSpeaker, showTimezone } from "@/services/run-of-show/eventShow";
import { formatEventDate } from "@/lib/utils/format";

/** "You're on at 6:31 PM": the speaker's own segments from the run of show, by time. */
async function YourSlot({ eventId, speakerId }: { eventId: string; speakerId: string }) {
  const show = await getEventShow(eventId).catch(() => undefined);
  const mine = show ? segmentsForSpeaker(show, speakerId) : [];
  const timezone = showTimezone(eventId);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="speaker-your-slot" data-slots={mine.length}>
      <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Your slot</p>
      {mine.length ? (
        <ul className="mt-2 space-y-2">
          {mine.map((run) => (
            <li key={run.segment.id} className="text-lg font-black text-slate-950">
              {run.state === "current" ? "You're on now" : run.state === "skipped" ? "Skipped" : `${run.state === "done" ? "You were on at" : "You're on at"} ${formatEventDate(run.segment.startAt, timezone)}`}: {run.segment.title}
              <span className="block text-sm font-normal text-slate-600">{run.segment.durationMinutes} min · {run.segment.room}{run.segment.host ? ` · host ${run.segment.host}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Your producer has not put you on a segment yet. Your time appears here as soon as they do.</p>
      )}
    </section>
  );
}

function Row({ label, value, href, good }: { label: string; value: string; href: string; good: boolean }) {
  return <a href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 hover:border-brand-orange"><span className="font-semibold text-slate-950">{label}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${good ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{value}</span></a>;
}

/** The speaker landing: who you are, then the three things to do before your slot. */
export async function SpeakerPortalHome({ eventId, speaker, error, viewAs }: { eventId: string; speaker?: SpecialGuestProfile; error?: string; viewAs?: string }) {
  const [stage, techCheck, deck] = speaker ? await Promise.all([getSpeakerStageState(eventId, speaker.guestId), getSpeakerTechCheck(eventId, speaker.guestId), getSpeakerCueDeck(eventId, speaker.guestId)]) : [undefined, undefined, undefined];
  return (
    <div className="space-y-6">
      <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}`} existing={speaker} error={error} compact={Boolean(speaker)} readOnly={Boolean(viewAs)} />
      {speaker ? await YourSlot({ eventId, speakerId: speaker.guestId }) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="speaker-onboarding-checklist">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Your onboarding checklist</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Tech check, cue cards, then the green room.</h2>
        <p className="mt-2 text-sm text-slate-600">Bio, headshot, and deck go to the producer by the link they sent you; this portal is for show day.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Row label="Tech check" value={techCheck ? `${techCheck.status.replaceAll("_", " ")} · ${techCheck.score}/100` : "not recorded"} href={withViewAs(`/speaker/events/${eventId}/tech-check`, viewAs)} good={techCheck?.status === "ready"} />
          <Row label="Cue cards" value={deck?.approved ? `v${deck.approved.versionNumber} approved` : deck?.pending ? "waiting for producer" : "none yet"} href={withViewAs(`/speaker/events/${eventId}/teleprompter`, viewAs)} good={Boolean(deck?.approved)} />
          <Row label="Stage" value={stage ? stage.status.replaceAll("_", " ") : "backstage"} href={withViewAs(`/speaker/events/${eventId}/green-room`, viewAs)} good={stage?.status === "on_stage"} />
        </div>
      </section>
    </div>
  );
}
