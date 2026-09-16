import { SpeakerManager } from "@/components/speakers/SpeakerManager";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function SpeakersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <SpeakerManager eventId={resolvedParams.eventId} />; }
