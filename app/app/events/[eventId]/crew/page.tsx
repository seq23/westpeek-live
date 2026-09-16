import { CrewInstructionManager } from "@/components/events/CrewInstructionManager";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventCrewInstructionsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <CrewInstructionManager eventId={resolvedParams.eventId} />;
}
