import { SponsorManager } from "@/components/sponsors/SponsorManager";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <SafeSection label="Sponsors" render={() => SponsorManager({ eventId: resolvedParams.eventId })} />;
}
