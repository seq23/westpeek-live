import { TaskBoard } from "@/components/tasks/TaskBoard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function TimelineRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <TaskBoard eventId={resolvedParams.eventId} />;
}
