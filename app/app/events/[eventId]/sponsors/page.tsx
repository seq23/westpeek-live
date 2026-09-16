import { SponsorManager } from "@/components/sponsors/SponsorManager";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function SponsorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <SponsorManager eventId={resolvedParams.eventId} />; }
