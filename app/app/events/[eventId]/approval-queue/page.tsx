import { EventApprovalQueue } from "@/components/approvals/EventApprovalQueue";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

export default async function EventApprovalQueuePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <main className="space-y-6"><SafeSection label="Approvals" render={() => EventApprovalQueue({ eventId: resolvedParams.eventId })} /></main>;
}
