import { VideoHealthPanel } from "@/components/production/VideoHealthPanel";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventVideoHealthPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <VideoHealthPanel eventId={resolvedParams.eventId} />;
}
