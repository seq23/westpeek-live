import { TaskBoard } from "@/components/tasks/TaskBoard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function TasksRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <SafeSection label="Tasks" render={() => TaskBoard({ eventId: resolvedParams.eventId })} />;
}
