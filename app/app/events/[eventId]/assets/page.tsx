import { AssetLibrary } from "@/components/assets/AssetLibrary";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function AssetsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <AssetLibrary eventId={resolvedParams.eventId} />; }
