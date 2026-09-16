import { LegalFooter } from "@/components/legal/LegalFooter";
import { EventRegistration } from "@/components/venue/PublicEventPage";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function RegisterRoute({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.slug);
  return (
    <>
      <EventRegistration slug={resolvedParams.slug} />
      <LegalFooter variant="standard" />
    </>
  );
}
