import { OperationalPersistencePanel } from "@/components/persistence/OperationalPersistencePanel";
import { EventApprovalQueue } from "@/components/approvals/EventApprovalQueue";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function EventApprovalQueuePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <main className="space-y-6"><OperationalPersistencePanel /><EventApprovalQueue eventId={resolvedParams.eventId} /></main>; }
