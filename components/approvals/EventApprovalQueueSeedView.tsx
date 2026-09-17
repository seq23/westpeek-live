import { getApprovalSummary, getEventApprovalQueue } from "@/services/approval-ops";
import { getRuntimeData } from "@/lib/runtime/getRuntimeData";
import { MetricCard } from "@/components/shared/MetricCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LastMinuteChangeQueue } from "./LastMinuteChangeQueue";
import { SpeakerMaterialIntakePanel } from "@/components/speakers/SpeakerMaterialIntakePanel";

/**
 * @seed-view — the demo/seed branch of the approval queue. Its approval items and its last-minute
 * change requests are the demo summit's fixtures, which is what a demo event is for. A real runtime
 * event goes to EventApprovalQueue's runtime branch, which reads the files and cue decks actually
 * waiting on it.
 */
export function EventApprovalQueueSeedView({ eventId }: { eventId: string }) {
  const event = getRuntimeData().events.find((item) => item.id === eventId);
  const items = getEventApprovalQueue(eventId);
  const summary = getApprovalSummary(eventId);
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Approvals · demo event</p>
        <h1 className="mt-2 text-3xl font-semibold">{event ? `${event.name}: approvals, blockers, and final locks` : "Approvals, blockers, and final locks"}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total approvals" value={summary.total} />
        <MetricCard label="Agency review" value={summary.needsAgencyReview} />
        <MetricCard label="Client review" value={summary.needsClientReview} />
        <MetricCard label="Blocking" value={summary.blocking} />
      </div>
      <SectionCard title="Approval items">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between">
                <p className="font-semibold">{item.title}</p>
                <StatusBadge status={item.status} tone={["approved", "locked", "used_live"].includes(item.status) ? "good" : "warn"} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{item.lastComment}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <LastMinuteChangeQueue eventId={eventId} />
      <SpeakerMaterialIntakePanel eventId={eventId} />
    </div>
  );
}
