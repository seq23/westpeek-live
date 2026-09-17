import { SpeakerManager } from "@/components/speakers/SpeakerManager";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function SpeakersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <SafeSection label="Speakers" render={() => SpeakerManager({ eventId: resolvedParams.eventId })} />;
}
