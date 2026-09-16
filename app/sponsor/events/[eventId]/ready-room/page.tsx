import { SponsorReadyRoom } from "@/components/sponsors/SponsorReadyRoom";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function SponsorReadyRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <SponsorReadyRoom eventId={resolvedParams.eventId} />; }
