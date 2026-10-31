import { ManageEventTabs } from "@/components/events/ManageEventTabs";
import { IncidentLog } from "@/components/production/IncidentLog";

/** The event's incident log page in the workspace: the real log, newest first, and the form to add one. */
export async function IncidentPanel({ eventId }: { eventId: string }) {
  return (
    <div className="space-y-6">
      <ManageEventTabs eventId={eventId} />
      <IncidentLog eventId={eventId} heading="h1" />
    </div>
  );
}
