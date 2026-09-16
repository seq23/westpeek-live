import { EventVendorBoard } from "@/components/vendors/VendorBoard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function EventVendorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <EventVendorBoard eventId={resolvedParams.eventId} />; }
