import { MetricCard } from "@/components/shared/MetricCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LocalTime } from "@/components/shared/LocalTime";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { EventApprovalQueueSeedView } from "@/components/approvals/EventApprovalQueueSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { listWorkspaceSpeakers } from "@/services/events/eventWorkspaceReadModel";
import { listEventAssets } from "@/services/assets/eventAssetService";

/**
 * What is actually waiting on the producer for a REAL event: files somebody sent that are still in
 * review, and speaker cue decks with a version pending approval. Both are runtime rows, both have
 * a place to go and act on them.
 *
 * There is no generic approvals table, so nothing else is claimed here. The page used to render two
 * demo approval items ("Drake Speaker show-day script v3") and the demo's last-minute change
 * requests on every event.
 */
export async function EventApprovalQueue({ eventId }: { eventId: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <EventApprovalQueueSeedView eventId={eventId} />;
  const [assets, speakers] = await Promise.all([listEventAssets(event.id).catch(() => []), listWorkspaceSpeakers(event.id)]);
  const filesWaiting = assets.filter((asset) => asset.status === "in_review" || asset.status === "changes_requested");
  const decksWaiting = speakers.filter((speaker) => speaker.cueDeckPending);
  const total = filesWaiting.length + decksWaiting.length;

  return (
    <div className="space-y-6" data-testid="event-approval-queue" data-waiting={total}>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Approvals</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}: what is waiting on you</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Two things on a real event need your word before they are live: a file somebody sent, and a speaker&rsquo;s cue deck. Nothing else is tracked as an approval, so nothing else is listed.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Waiting on you" value={total} />
        <MetricCard label="Files in review" value={filesWaiting.length} note={`${assets.length} file(s) on this event`} />
        <MetricCard label="Cue decks pending" value={decksWaiting.length} note={`${speakers.length} speaker(s) arrived`} />
      </div>

      <SectionCard title="Files waiting for review" eyebrow={filesWaiting.length ? `${filesWaiting.length} waiting` : "clear"}>
        {filesWaiting.length ? (
          <div className="space-y-3" data-testid="approval-files">
            {filesWaiting.map((asset) => (
              <div key={asset.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{asset.fileName}</p>
                  <StatusBadge status={asset.status.replaceAll("_", " ")} tone="warn" />
                </div>
                <p className="mt-1 text-sm text-slate-600">{asset.uploadedByLabel} ({asset.uploadedByKind}) · <LocalTime iso={asset.createdAt} mode="datetime" /></p>
              </div>
            ))}
            <a href={`/app/events/${event.id}/assets`} className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white">Review them on Assets</a>
          </div>
        ) : (
          <WorkspaceEmptyState
            testId="approval-files-empty"
            title="No file is waiting for review"
            line="Anything a speaker, sponsor or crew member sends this event arrives as 'in review' and shows up here until you approve it or ask for changes."
            actionHref={`/app/events/${event.id}/assets`}
            actionLabel="Open assets"
          />
        )}
      </SectionCard>

      <SectionCard title="Cue decks waiting for approval" eyebrow={decksWaiting.length ? `${decksWaiting.length} waiting` : "clear"}>
        {decksWaiting.length ? (
          <div className="space-y-3" data-testid="approval-cue-decks">
            {decksWaiting.map((speaker) => (
              <div key={speaker.guestId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold">{speaker.name} submitted a new cue deck version</p>
                <StatusBadge status="pending" tone="warn" />
              </div>
            ))}
            <a href={`/app/events/${event.id}`} className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white">Approve on the crew deck</a>
          </div>
        ) : (
          <WorkspaceEmptyState
            testId="approval-cue-decks-empty"
            title="No cue deck is waiting"
            line="Cue cards, talking points and scripts are written per speaker on the crew deck. When a speaker edits their own from the green room, the version waits here and on their row until you approve it; what you approve is on their teleprompter within about five seconds."
            actionHref={`/app/events/${event.id}`}
            actionLabel="Open the crew deck"
          />
        )}
      </SectionCard>
    </div>
  );
}
