import { LegalFooter } from "@/components/legal/LegalFooter";
import { EventRegistration } from "@/components/venue/PublicEventPage";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function RegisterRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ email?: string; wait?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.slug);
  // An email that did not match a registration comes back typed in, with no word about why.
  const prefillEmail = String(resolvedSearchParams?.email || "").trim().slice(0, 254);
  const waitSeconds = Number(resolvedSearchParams?.wait) > 0 ? Math.min(Number(resolvedSearchParams?.wait), 3600) : undefined;
  return (
    <>
      <EventRegistration slug={resolvedParams.slug} prefillEmail={prefillEmail} waitSeconds={waitSeconds} />
      <LegalFooter variant="standard" />
    </>
  );
}
