import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";
import { SpeakerGreenRoomLive } from "@/components/speakers/SpeakerGreenRoomLive";

export default async function SpeakerGreenRoomPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const speaker = await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  return (
    <SpeakerPortalShell eventId={eventId} active="green-room" speaker={speaker} stage={stage}>
      {speaker ? <SpeakerGreenRoomLive eventId={eventId} speaker={speaker} error={query?.error} /> : <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}/green-room`} error={query?.error} />}
    </SpeakerPortalShell>
  );
}
