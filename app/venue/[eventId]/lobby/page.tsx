import { buildVirtualVenueModel } from "@/services/venue";
import { VenueLobbyDashboard } from "@/components/venue/VenueLobbyDashboard";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { HostJoinCodeBanner } from "@/components/venue/HostJoinCodeBanner";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { VipLobbyPanel } from "@/components/venue/VipLobbyPanel";
import { VipCodeCard } from "@/components/venue/VipCodeCard";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { vipStandingFor } from "@/services/guests/vipGrantService";
import { getCurrentSpecialGuestAccess } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { ViewAsBanner } from "@/components/guests/ViewAsBanner";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ created?: string; error?: string; viewAs?: string; saved?: string; vip?: "1" | "no" }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const runtimeEvent = await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  // Only a workspace actor (owner cookie, operator cookie, or staff session) sees the host panel; attendees never do.
  const actor = runtimeEvent && runtimeEvent.source !== "seed" ? await getWorkspaceActor() : null;
  // The host is also the executive_producer crew role for this event (a host link), not only owner / operator.
  const crewHost = runtimeEvent && runtimeEvent.source !== "seed" && !actor ? (await getCrewViewer(resolvedParams.eventId)).isHost : false;
  const isHost = Boolean(actor) || crewHost;
  const guest = await getCurrentSpecialGuestAccess(resolvedParams.eventId);
  // VIP is code-bound: either a VIP cookie from the gate, or a grant this attendee holds.
  const attendee = await getCurrentAttendeeProfile(resolvedParams.eventId).catch(() => undefined);
  const vipStanding = attendee ? await vipStandingFor(resolvedParams.eventId, attendee.attendeeId).catch(() => undefined) : undefined;
  // "View as" a VIP: an owner / operator / producer sees the VIP panel as that person, read-mostly.
  const viewAs = await resolveViewAs(resolvedParams.eventId, resolvedSearchParams?.viewAs, "vip");
  return (
    <VenuePageShell model={model}>
      {viewAs ? <ViewAsBanner viewAs={viewAs} backHref={`/crew/events/${resolvedParams.eventId}`} /> : null}
      {isHost && runtimeEvent && !viewAs ? <HostJoinCodeBanner event={runtimeEvent} justCreated={resolvedSearchParams?.created === "1"} crewHost={crewHost} /> : null}
      {guest?.role === "vip" || viewAs || vipStanding?.current ? <SafeSection label="VIP" render={() => VipLobbyPanel({ eventId: resolvedParams.eventId, error: resolvedSearchParams?.error, viewAs, grantedName: vipStanding?.current ? vipStanding.name : undefined })} /> : null}
      {!viewAs && guest?.role !== "vip" && !vipStanding?.current ? <VipCodeCard eventId={resolvedParams.eventId} registered={Boolean(attendee)} result={resolvedSearchParams?.vip} /> : null}
      <SafeSection label="Lobby" render={() => VenueLobbyDashboard({ model, saved: resolvedSearchParams?.saved === "profile" })} />
    </VenuePageShell>
  );
}
