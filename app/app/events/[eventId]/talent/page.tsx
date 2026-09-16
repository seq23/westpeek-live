import { TalentReadinessDashboard } from "@/components/production/TalentReadinessDashboard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function TalentPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <TalentReadinessDashboard eventId={resolvedParams.eventId} />; }
