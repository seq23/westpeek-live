import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";
import { SpeakerTechCheckLive } from "@/components/speakers/SpeakerTechCheckLive";
import { getSpeakerTechCheck } from "@/services/guests/guestStateService";

export default async function SpeakerTechCheckPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ recorded?: string; error?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const speaker = await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  const previous = speaker ? await getSpeakerTechCheck(eventId, speaker.guestId) : undefined;
  return (
    <SpeakerPortalShell eventId={eventId} active="tech-check" speaker={speaker} stage={stage}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Speaker tech check</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">Camera, microphone, speaker, and connection check.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Run each check, then record the result. The crew sees it on your roster row before they bring you to the stage.</p>
      </section>
      {speaker ? <SpeakerTechCheckLive eventId={eventId} previous={previous} recorded={query?.recorded === "1"} /> : <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}/tech-check`} error={query?.error} />}
    </SpeakerPortalShell>
  );
}
