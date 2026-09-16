import { SpeakerPortalShell } from "@/components/speakers/SpeakerPortalShell";
import { SpeakerPortalHome } from "@/components/speakers/SpeakerPortalHome";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";

export default async function SpeakerEventPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const speaker = await getCurrentGuestIdentity(eventId, "speaker");
  const stage = speaker ? await getSpeakerStageState(eventId, speaker.guestId) : undefined;
  return <SpeakerPortalShell eventId={eventId} active="home" speaker={speaker} stage={stage}><SpeakerPortalHome eventId={eventId} speaker={speaker} error={query?.error} /></SpeakerPortalShell>;
}
