import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";
import { SpeakerTechCheckLive } from "@/components/speakers/SpeakerTechCheckLive";
import { getSpeakerTechCheck } from "@/services/guests/guestStateService";

export default async function SpeakerTechCheckPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ recorded?: string; error?: string; viewAs?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const viewAs = await resolveViewAs(eventId, query?.viewAs, "speaker");
  const speaker = viewAs?.guest || await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  const previous = speaker ? await getSpeakerTechCheck(eventId, speaker.guestId) : undefined;
  return (
    <SpeakerPortalShell eventId={eventId} active="tech-check" speaker={speaker} stage={stage} viewAs={viewAs}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Speaker tech check</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">Camera, microphone, speaker, and connection check.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Run each check, then record the result. The crew sees it on your roster row before they bring you to the stage.</p>
      </section>
      {viewAs ? <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="tech-check-preview-disabled"><p className="text-sm font-black text-slate-950">Tech check is theirs to run.</p><p className="mt-2 text-sm text-slate-600">Recorded result: {previous ? `${previous.status.replaceAll("_", " ")} · ${previous.score}/100 · ${new Date(previous.recordedAt).toLocaleString()}` : "not recorded yet"}. Running it here would record a result under {speaker?.name}&rsquo;s name, so it is disabled in preview.</p></section> : speaker ? <SpeakerTechCheckLive eventId={eventId} previous={previous} recorded={query?.recorded === "1"} /> : <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}/tech-check`} error={query?.error} />}
    </SpeakerPortalShell>
  );
}
