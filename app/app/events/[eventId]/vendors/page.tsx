import { EventSupplierBoard } from "@/components/suppliers/EventSupplierBoard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

/** The companies supplying this event: attach one already on file, or add a new one here. */
export default async function EventVendorsPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { eventId } = await params;
  const resolved = await searchParams;
  await ensureRuntimeEvent(eventId);
  return <SafeSection label="Vendors" render={() => EventSupplierBoard({ eventId, kind: "vendor", searchParams: resolved })} />;
}
