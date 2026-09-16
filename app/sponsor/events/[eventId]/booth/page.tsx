import { SponsorPortalLive } from "@/components/sponsors/SponsorPortalLive";
import { GuestAssetUpload } from "@/components/assets/GuestAssetUpload";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { resolveViewAs } from "@/lib/auth/viewAs";

export const dynamic = "force-dynamic";

export default async function SponsorBoothPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ saved?: string; error?: string; viewAs?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const viewAs = await resolveViewAs(eventId, query?.viewAs, "sponsor");
  const sponsor = viewAs?.guest || await getCurrentGuestIdentity(eventId, "sponsor");
  return (
    <div className="space-y-4">
      <SponsorPortalLive eventId={eventId} surface="booth" sponsor={sponsor} saved={query?.saved === "1"} error={query?.error} viewAs={viewAs} />
      {sponsor ? <SafeSection label="Your files" render={() => GuestAssetUpload({ eventId, role: "sponsor", name: sponsor.name, readOnly: Boolean(viewAs) })} /> : null}
    </div>
  );
}
