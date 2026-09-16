import { SponsorSetupWizard } from "@/components/sponsors/SponsorSetupWizard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function SponsorSetupPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <SponsorSetupWizard eventId={resolvedParams.eventId} />; }
