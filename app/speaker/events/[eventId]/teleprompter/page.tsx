import { SpeakerTeleprompterPanel } from "@/components/speakers/SpeakerTeleprompterPanel";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function SpeakerTeleprompterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl"><SpeakerTeleprompterPanel eventId={resolvedParams.eventId} /></div></main>; }
