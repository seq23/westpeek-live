import { TestingConsole } from "@/components/testing/TestingConsole";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventTestingConsolePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <TestingConsole eventId={resolvedParams.eventId} />;
}
