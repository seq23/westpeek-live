import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { SpeakerPortalHome } from "@/components/speakers/SpeakerPortalHome";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";

export default async function SpeakerEventPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ error?: string; viewAs?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const viewAs = await resolveViewAs(eventId, query?.viewAs, "speaker");
  const speaker = viewAs?.guest || await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  return <SpeakerPortalShell eventId={eventId} active="home" speaker={speaker} stage={stage} viewAs={viewAs}><SpeakerPortalHome eventId={eventId} speaker={speaker} error={query?.error} viewAs={viewAs?.guest.guestId} /></SpeakerPortalShell>;
}
