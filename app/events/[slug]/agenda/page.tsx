import { PublicEventPage } from "@/components/venue/PublicEventPage";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function AgendaRoute({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.slug); return <PublicEventPage slug={resolvedParams.slug} />; }
