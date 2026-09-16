import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";
import { GuestRoomVideo } from "@/components/video/GuestRoomVideo";

/** "On stage": the main-stage LiveKit room with the speaker's publish grant, once the crew brought them up. */
export default async function SpeakerOnStagePage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ viewAs?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const viewAs = await resolveViewAs(eventId, query?.viewAs, "speaker");
  const speaker = viewAs?.guest || await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  return (
    <SpeakerPortalShell eventId={eventId} active="backstage" speaker={speaker} stage={stage} viewAs={viewAs}>
      {!speaker ? <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}/backstage`} /> : stage?.status === "backstage" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="speaker-on-stage" data-stage-grant="backstage">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Backstage</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">You are not on the stage yet.</h2>
          <p className="mt-2 text-sm text-slate-600">The crew brings you to the stage from the green room. Until then this room refuses a stage token.</p>
          <a href={viewAs ? `/speaker/events/${eventId}/green-room?viewAs=${encodeURIComponent(viewAs.guest.guestId)}` : `/speaker/events/${eventId}/green-room`} className="mt-4 inline-block rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white">Back to the green room</a>
        </section>
      ) : (
        <div className="space-y-4" data-testid="speaker-on-stage" data-stage-grant={stage?.status}>
          <section className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-800">On stage</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Your camera and microphone publish to the main stage. Attendees see your tile.</h2>
            <p className="mt-2 text-sm text-slate-700">When the crew sends you backstage, this room closes and you return to the green room.</p>
          </section>
          {viewAs ? <div className="rounded-3xl bg-slate-950 p-4 text-white" data-testid="guest-room-video-preview-placeholder"><p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Main stage</p><p className="mt-3 rounded-2xl bg-white/10 p-6 text-sm text-slate-200">Not joined in preview: joining would publish to the stage under {speaker.name}&rsquo;s name.</p></div> : <GuestRoomVideo eventId={eventId} roomId="main-stage" roomType="main_stage" role="speaker" displayName={speaker.name} title="Main stage" />}
        </div>
      )}
    </SpeakerPortalShell>
  );
}
