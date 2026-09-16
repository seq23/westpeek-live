import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { getSpeakerCueDeck, getSpeakerStageState, getSpeakerTechCheck } from "@/services/guests/guestStateService";
import type { SpecialGuestProfile } from "@/types/specialGuest";
import { withViewAs } from "@/lib/auth/viewAsGuard";

function Row({ label, value, href, good }: { label: string; value: string; href: string; good: boolean }) {
  return <a href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 hover:border-brand-orange"><span className="font-semibold text-slate-950">{label}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${good ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{value}</span></a>;
}

/** The speaker landing: who you are, then the three things to do before your slot. */
export async function SpeakerPortalHome({ eventId, speaker, error, viewAs }: { eventId: string; speaker?: SpecialGuestProfile; error?: string; viewAs?: string }) {
  const [stage, techCheck, deck] = speaker ? await Promise.all([getSpeakerStageState(eventId, speaker.guestId), getSpeakerTechCheck(eventId, speaker.guestId), getSpeakerCueDeck(eventId, speaker.guestId)]) : [undefined, undefined, undefined];
  return (
    <div className="space-y-6">
      <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}`} existing={speaker} error={error} compact={Boolean(speaker)} readOnly={Boolean(viewAs)} />
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
