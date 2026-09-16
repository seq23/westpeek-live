import { ApprovalQueue } from "@/components/approvals/ApprovalQueue";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function ApprovalsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <ApprovalQueue eventId={resolvedParams.eventId} />; }
