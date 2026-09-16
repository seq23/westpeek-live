import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";
import { SpeakerGreenRoomLive } from "@/components/speakers/SpeakerGreenRoomLive";
import { GuestAssetUpload } from "@/components/assets/GuestAssetUpload";
import { SafeSection } from "@/components/system/SafeSection";

export default async function SpeakerGreenRoomPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ error?: string; viewAs?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const viewAs = await resolveViewAs(eventId, query?.viewAs, "speaker");
  const speaker = viewAs?.guest || await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  return (
    <SpeakerPortalShell eventId={eventId} active="green-room" speaker={speaker} stage={stage} viewAs={viewAs}>
      {speaker ? (
        <div className="space-y-4">
          <SpeakerGreenRoomLive eventId={eventId} speaker={speaker} error={query?.error} viewAs={viewAs?.guest.guestId} />
          <SafeSection label="Your files" render={() => GuestAssetUpload({ eventId, role: "speaker", name: speaker.name, readOnly: Boolean(viewAs) })} />
        </div>
      ) : <GuestIdentityForm eventId={eventId} role="speaker" returnTo={`/speaker/events/${eventId}/green-room`} error={query?.error} />}
    </SpeakerPortalShell>
  );
}
