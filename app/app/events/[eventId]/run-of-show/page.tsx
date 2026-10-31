import { RunOfShowPage } from "@/components/run-of-show/RunOfShowPage";
import { LiveRunOfShowDashboard } from "@/components/run-of-show/LiveRunOfShowDashboard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getEventShow } from "@/services/run-of-show/eventShow";

export const dynamic = "force-dynamic";

export default async function RunOfShowRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  // One reading of the show for the whole page: the timeline and the tracker cannot disagree.
  const show = await getEventShow(resolvedParams.eventId);
  return (
    <div className="space-y-6">
      <SafeSection label="Run of show" render={() => RunOfShowPage({ eventId: resolvedParams.eventId, show })} />
      <SafeSection label="Run of show progress" render={() => LiveRunOfShowDashboard({ eventId: resolvedParams.eventId, viewer: "agency", showControls: true, show })} />
    </div>
  );
}
