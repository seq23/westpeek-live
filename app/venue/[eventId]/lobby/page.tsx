import { buildVirtualVenueModel } from "@/services/venue";
import { VenueLobbyDashboard } from "@/components/venue/VenueLobbyDashboard";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { HostJoinCodeBanner } from "@/components/venue/HostJoinCodeBanner";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ created?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const runtimeEvent = await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  // Only a workspace actor (owner cookie, operator cookie, or staff session) sees the host panel; attendees never do.
  const actor = runtimeEvent && runtimeEvent.source !== "seed" ? await getWorkspaceActor() : null;
  return (
    <VenuePageShell model={model}>
      {actor && runtimeEvent ? <HostJoinCodeBanner event={runtimeEvent} justCreated={resolvedSearchParams?.created === "1"} /> : null}
      <VenueLobbyDashboard model={model} />
    </VenuePageShell>
  );
}
