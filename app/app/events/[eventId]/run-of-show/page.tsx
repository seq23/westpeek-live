import { RunOfShowPage } from "@/components/run-of-show/RunOfShowPage";
import { LiveRunOfShowDashboard } from "@/components/run-of-show/LiveRunOfShowDashboard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function RunOfShowRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <div className="space-y-6">
      <SafeSection label="Run of show" render={() => RunOfShowPage({ eventId: resolvedParams.eventId })} />
      <LiveRunOfShowDashboard eventId={resolvedParams.eventId} viewer="agency" showControls />
    </div>
  );
}
