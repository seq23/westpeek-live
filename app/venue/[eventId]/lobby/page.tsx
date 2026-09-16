import { buildVirtualVenueModel } from "@/services/venue";
import { VenueLobbyDashboard } from "@/components/venue/VenueLobbyDashboard";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { HostJoinCodeBanner } from "@/components/venue/HostJoinCodeBanner";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { VipLobbyPanel } from "@/components/venue/VipLobbyPanel";
import { VipCodeCard } from "@/components/venue/VipCodeCard";
import { currentAttendeeMayHoldPrivilege, getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { vipStandingFor } from "@/services/guests/vipGrantService";
import { getCurrentSpecialGuestAccess } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { resolvePreviewView } from "@/lib/auth/previewView";
import { PreviewBanner } from "@/components/preview/PreviewBanner";
import { ViewAsBanner } from "@/components/guests/ViewAsBanner";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ created?: string; error?: string; viewAs?: string; leaveTo?: string; saved?: string; vip?: "1" | "no"; returned?: string }> }) {
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
  // VIP never rides in on an unverified email: a session restored from an address alone is not
  // evidence of who is holding the phone, so the grant stays behind until the code is entered here.
  const mayHoldPrivilege = attendee ? await currentAttendeeMayHoldPrivilege(resolvedParams.eventId) : false;
  const vipStanding = attendee && mayHoldPrivilege ? await vipStandingFor(resolvedParams.eventId, attendee.attendeeId).catch(() => undefined) : undefined;
  // "View as" a VIP: an owner / operator / producer sees the VIP panel as that person, read-mostly.
  const viewAs = await resolveViewAs(resolvedParams.eventId, resolvedSearchParams?.viewAs, "vip");
  // "An attendee" / "A VIP" from Enter the room, or "See their view" on a real attendee: the room as
  // that person has it, read-only. Personas and mirrors both refuse every write at the service layer.
  const preview = await resolvePreviewView(resolvedParams.eventId, resolvedSearchParams?.viewAs);
  return (
    <VenuePageShell model={model}>
      {preview ? <PreviewBanner preview={preview} leaveHref={resolvedSearchParams?.leaveTo || `/app/events/${resolvedParams.eventId}`} /> : viewAs ? <ViewAsBanner viewAs={viewAs} backHref={`/crew/events/${resolvedParams.eventId}`} /> : null}
      {isHost && runtimeEvent && !viewAs && !preview ? <HostJoinCodeBanner event={runtimeEvent} justCreated={resolvedSearchParams?.created === "1"} crewHost={crewHost} /> : null}
      {guest?.role === "vip" || viewAs || vipStanding?.current || preview?.state.vip ? <SafeSection label="VIP" render={() => VipLobbyPanel({ eventId: resolvedParams.eventId, error: resolvedSearchParams?.error, viewAs, grantedName: vipStanding?.current ? vipStanding.name : undefined })} /> : null}
      {!viewAs && !preview && guest?.role !== "vip" && !vipStanding?.current ? <VipCodeCard eventId={resolvedParams.eventId} registered={Boolean(attendee)} result={resolvedSearchParams?.vip} /> : null}
      <SafeSection label="Lobby" render={() => VenueLobbyDashboard({ model, saved: resolvedSearchParams?.saved === "profile", justReturned: resolvedSearchParams?.returned === "1" })} />
    </VenuePageShell>
  );
}
