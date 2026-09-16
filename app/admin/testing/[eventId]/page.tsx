import { TestingConsole } from "@/components/testing/TestingConsole";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventTestingConsolePage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ roster?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <TestingConsole eventId={resolvedParams.eventId} rosterSearch={resolvedSearchParams?.roster || ""} />;
}
