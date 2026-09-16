import { LiveKitRoomShell } from "@/components/video/LiveKitRoomShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function TestingLiveKitRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <LiveKitRoomShell
      eventId={resolvedParams.eventId}
      roomId={`${resolvedParams.eventId}-testing`}
      roomType="testing"
      role="producer"
      title="LiveKit Testing Room"
      description="Testing room for producer diagnostics, camera checks, microphone checks, and provider readiness."
    />
  );
}
