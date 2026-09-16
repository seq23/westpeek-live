import { EventSupplierBoard } from "@/components/suppliers/EventSupplierBoard";
import { TalentReadinessDashboard } from "@/components/production/TalentReadinessDashboard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

/** The people this event pays, above the speaker and sponsor readiness this page already carried. */
export default async function TalentPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { eventId } = await params;
  const resolved = await searchParams;
  await ensureRuntimeEvent(eventId);
  return (
    <div className="space-y-6">
      <SafeSection label="Contractors" render={() => EventSupplierBoard({ eventId, kind: "contractor", searchParams: resolved })} />
      <TalentReadinessDashboard eventId={eventId} />
    </div>
  );
}
