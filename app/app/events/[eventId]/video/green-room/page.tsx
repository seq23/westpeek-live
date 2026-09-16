import { LiveKitRoomShell } from "@/components/video/LiveKitRoomShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function GreenRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <LiveKitRoomShell
      eventId={resolvedParams.eventId}
      roomId={`${resolvedParams.eventId}-green-room`}
      roomType="green_room"
      role="speaker"
      title="Speaker Green Room"
      description="Private speaker preparation room for call time, device checks, and producer handoff."
    />
  );
}
