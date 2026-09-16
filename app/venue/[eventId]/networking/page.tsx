import { buildVirtualVenueModel } from "@/services/venue";
import { NetworkingLobby } from "@/components/venue/NetworkingLobby";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function NetworkingPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  return (
    <VenuePageShell model={model}>
      <NetworkingLobby model={model} />
    </VenuePageShell>
  );
}
