import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";
import { SpeakerCuePastePanel } from "@/components/speakers/SpeakerCuePastePanel";
import { SpeakerTeleprompterLive } from "@/components/speakers/SpeakerTeleprompterLive";
import { getSpeakerCueDeck, getSpeakerLiveCue } from "@/services/guests/guestStateService";
import { BACKSTAGE } from "@/services/guests/guestStateService";

export default async function SpeakerTeleprompterPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ submitted?: string; error?: string; viewAs?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const viewAs = await resolveViewAs(eventId, query?.viewAs, "speaker");
  const speaker = viewAs?.guest || await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  const [deck, liveCue] = speaker ? await Promise.all([getSpeakerCueDeck(eventId, speaker.guestId), getSpeakerLiveCue(eventId, speaker.guestId)]) : [{ nextVersionNumber: 1 }, undefined];
  return (
    <SpeakerPortalShell eventId={eventId} active="teleprompter" speaker={speaker} stage={stage} viewAs={viewAs}>
      {!speaker ? <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}/teleprompter`} error={query?.error} compact /> : null}
      <SpeakerTeleprompterLive eventId={eventId} speakerId={viewAs?.guest.guestId} initial={{ approved: deck.approved || null, pendingVersionNumber: deck.pending?.versionNumber || null, liveCue: liveCue?.text ? liveCue : null, stage: stage || BACKSTAGE }} />
      <SpeakerCuePastePanel eventId={eventId} speaker={speaker} deck={deck} submitted={query?.submitted === "1"} readOnly={Boolean(viewAs)} />
    </SpeakerPortalShell>
  );
}
