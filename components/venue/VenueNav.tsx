import type { VenueNavItem } from "@/types/virtualVenue";
import { navMarkerFor, type VenueActivity } from "@/services/venue/venueActivityService";

const TONE: Record<"live" | "open" | "count", string> = {
  live: "bg-brand-orange text-white",
  open: "bg-emerald-400 text-emerald-950",
  count: "bg-white/20 text-white",
};

/**
 * The nav is the map of the venue, so it says what is happening rather than listing nouns: a
 * marker appears next to a surface only where getVenueActivity found a real, currently-true
 * signal. No marker is the normal state; a marker that reads 0 is never rendered.
 */
export function VenueNav({ items, activity }: { items: VenueNavItem[]; activity?: VenueActivity }) {
  return (
    <nav className="mobile-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06] p-1.5" aria-label="Venue">
      {items.map((item) => {
        const marker = activity ? navMarkerFor(item.surface, activity) : undefined;
        return (
          <a key={item.surface} href={item.href} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-white/85 hover:bg-brand-orange hover:text-white" data-nav-surface={item.surface}>
            {item.label}
            {marker ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${TONE[marker.tone]}`} data-nav-marker={item.surface}>{marker.label}</span> : null}
          </a>
        );
      })}
    </nav>
  );
}
