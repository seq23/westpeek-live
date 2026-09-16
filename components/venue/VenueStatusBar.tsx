import type { VirtualVenueModel } from "@/types/virtualVenue";
import type { VenueActivity } from "@/services/venue/venueActivityService";

/**
 * The lobby's "what is on" row — the lobby only, never repeated on all nine pages, and only tiles
 * that are non-zero and lead somewhere. A tile reading 0 told a newcomer nothing except that
 * something was missing (the owner, 16 Sep 2026).
 */
export function VenueStatusBar({ model, activity }: { model: VirtualVenueModel; activity: VenueActivity }) {
  const base = `/venue/${model.eventId}`;
  const tiles = [
    activity.stageLive ? { label: "On the main stage now", value: activity.liveSessionTitle || "The show is live", href: `${base}/stage` } : undefined,
    activity.networkingOpen ? { label: "Networking", value: activity.networkingQueueSize > 0 ? `${activity.networkingQueueSize} waiting to meet someone` : "Open. Join the queue.", href: `${base}/networking` } : undefined,
    activity.boothCount > 0 ? { label: "Sponsor booths", value: `${activity.boothCount} to visit`, href: `${base}/expo` } : undefined,
    activity.replaysReady > 0 ? { label: "Replays", value: `${activity.replaysReady} ready to watch`, href: `${base}/replay` } : undefined,
  ].filter(Boolean) as { label: string; value: string; href: string }[];
  if (!tiles.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="venue-status-bar">
      {tiles.map((tile) => (
        <a key={tile.label} href={tile.href} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-orange">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{tile.label}</p>
          <p className="mt-1 text-sm font-black text-slate-950">{tile.value}</p>
        </a>
      ))}
    </div>
  );
}
