import { EventAssetLibrary } from "@/components/assets/EventAssetLibrary";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

/** This event's real files: upload, review, decide who sees them, archive. */
export default async function AssetsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await ensureRuntimeEvent(eventId);
  return <SafeSection label="Assets" render={() => EventAssetLibrary({ eventId })} />;
}
