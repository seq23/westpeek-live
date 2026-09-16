import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { listAssetsAcrossEvents } from "@/services/assets/eventAssetService";
import { listEventRecords } from "@/services/events/eventRepository";
import { assetSizeLabel, type EventAssetRecord } from "@/types/eventAssets";

/** Every file we hold, grouped by the event it belongs to. Open an event to act on its files. */
export async function AssetsAcrossEvents() {
  const assets = await listAssetsAcrossEvents();
  const events = await listEventRecords({ includeArchived: true, includeSeed: false }).catch(() => []);
  const names = Object.fromEntries(events.map((event) => [event.id, event.name]));
  const byEvent = new Map<string, EventAssetRecord[]>();
  for (const asset of assets) byEvent.set(asset.eventId, [...(byEvent.get(asset.eventId) || []), asset]);
  return (
    <SectionCard title="Assets across events" eyebrow={`${assets.length} file${assets.length === 1 ? "" : "s"} · ${byEvent.size} event${byEvent.size === 1 ? "" : "s"}`}>
      <div data-testid="assets-across-events" data-count={assets.length}>
        <p className="text-sm text-brand-muted">Every file any event holds, newest first. Approvals, visibility and archiving happen on the event&rsquo;s own Assets page.</p>
        {assets.length ? (
          <div className="mt-4 space-y-4">
            {Array.from(byEvent.entries()).map(([eventId, list]) => (
              <div key={eventId} className="rounded-2xl border border-brand-line p-3" data-testid={`assets-event-${eventId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{names[eventId] || eventId} <span className="ml-2 text-xs text-brand-muted">{list.length} file{list.length === 1 ? "" : "s"}</span></p>
                  <Link href={`/app/events/${eventId}/assets`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange">Open the library</Link>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-brand-muted">
                  {list.slice(0, 8).map((asset: EventAssetRecord) => (
                    <li key={asset.id} data-testid={`assets-row-${asset.id}`}>
                      <strong className="text-brand-black">{asset.fileName}</strong> · {asset.status.replaceAll("_", " ")} · {asset.visibility === "client_facing" ? "client sees it" : "internal"} · {asset.externalUrl ? "link" : assetSizeLabel(asset.sizeBytes)} · <LocalTime iso={asset.createdAt} mode="datetime" />
                    </li>
                  ))}
                  {list.length > 8 ? <li>…and {list.length - 8} more.</li> : null}
                </ul>
              </div>
            ))}
          </div>
        ) : <div className="mt-4"><EmptyState title="No files yet" body="Files appear the first time production, a speaker or a sponsor uploads one to an event." /></div>}
      </div>
    </SectionCard>
  );
}
