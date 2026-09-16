import { ProductionCommandCenter } from "@/components/production/ProductionCommandCenter";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function ProducerPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <ProductionCommandCenter eventId={resolvedParams.eventId} />;
}
