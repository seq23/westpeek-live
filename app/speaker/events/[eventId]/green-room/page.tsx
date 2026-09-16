import { SpeakerGreenRoom } from "@/components/speakers/SpeakerGreenRoom";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function SpeakerGreenRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <SpeakerGreenRoom eventId={resolvedParams.eventId} />; }
