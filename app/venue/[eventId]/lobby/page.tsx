import { buildVirtualVenueModel } from "@/services/venue";
import { VenueLobbyDashboard } from "@/components/venue/VenueLobbyDashboard";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { HostJoinCodeBanner } from "@/components/venue/HostJoinCodeBanner";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { VipLobbyPanel } from "@/components/venue/VipLobbyPanel";
import { getCurrentSpecialGuestAccess } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { ViewAsBanner } from "@/components/guests/ViewAsBanner";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ created?: string; error?: string; viewAs?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const runtimeEvent = await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  // Only a workspace actor (owner cookie, operator cookie, or staff session) sees the host panel; attendees never do.
  const actor = runtimeEvent && runtimeEvent.source !== "seed" ? await getWorkspaceActor() : null;
  const guest = await getCurrentSpecialGuestAccess(resolvedParams.eventId);
  // "View as" a VIP: an owner / operator / producer sees the VIP panel as that person, read-mostly.
  const viewAs = await resolveViewAs(resolvedParams.eventId, resolvedSearchParams?.viewAs, "vip");
  return (
    <VenuePageShell model={model}>
      {viewAs ? <ViewAsBanner viewAs={viewAs} backHref={`/crew/events/${resolvedParams.eventId}`} /> : null}
      {actor && runtimeEvent && !viewAs ? <HostJoinCodeBanner event={runtimeEvent} justCreated={resolvedSearchParams?.created === "1"} /> : null}
      {guest?.role === "vip" || viewAs ? <VipLobbyPanel eventId={resolvedParams.eventId} error={resolvedSearchParams?.error} viewAs={viewAs} /> : null}
      <VenueLobbyDashboard model={model} />
    </VenuePageShell>
  );
}
