import { ManageEventTabs } from "@/components/events/ManageEventTabs";
import { EventEmailCenter } from "@/components/email/EventEmailCenter";
import { EventCommunicationsDashboard } from "@/components/communications/EventCommunicationsDashboard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

/** What this event has sent, and what the crew can send now. The dashboard below is the plan. */
export default async function EventCommunicationsPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ sent?: string; workflow?: string; emailError?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  return (
    <div className="space-y-6">
      <ManageEventTabs eventId={eventId} />
      <SafeSection label="Communications" render={() => EventEmailCenter({ eventId, sent: query?.sent, workflowSent: query?.workflow, error: query?.emailError })} />
      <EventCommunicationsDashboard eventId={eventId} />
    </div>
  );
}
