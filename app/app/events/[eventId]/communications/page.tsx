import { ManageEventTabs } from "@/components/events/ManageEventTabs";
import { EventEmailCenter } from "@/components/email/EventEmailCenter";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

/**
 * One panel, one log.
 *
 * This page used to stack two: the eight-workflow send centre, and underneath it an older
 * "Resend status / Send / log status / Send log" dashboard writing to a second, different log.
 * Two send logs on one page is how you send the same email twice. The old one is gone; the one
 * thing it had that this did not — the crew call sheet — came across as the eighth workflow.
 */
export default async function EventCommunicationsPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ sent?: string; workflow?: string; emailError?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  return (
    <div className="space-y-6">
      <ManageEventTabs eventId={eventId} />
      <SafeSection label="Communications" render={() => EventEmailCenter({ eventId, sent: query?.sent, workflowSent: query?.workflow, error: query?.emailError })} />
    </div>
  );
}
