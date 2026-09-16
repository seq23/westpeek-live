"use client";

import { usePathname } from "next/navigation";
import type { VenueNavItem } from "@/types/virtualVenue";
import { navMarkerFor, type VenueActivity } from "@/services/venue/venueActivityService";

/**
 * The nav is how a guest knows where they are and what is happening, so it carries two things the
 * old flat row did not: the current page is visibly current (it had no active state at all, which
 * is most of why a person could not tell where they were), and a surface with something genuinely
 * happening wears a marker. A marker is rendered only where getVenueActivity found a real,
 * currently-true signal. No marker is the normal state; a marker reading 0 is never rendered.
 */
const TONE: Record<"live" | "open" | "count", string> = {
  live: "bg-brand-orange text-white",
  open: "bg-emerald-400 text-emerald-950",
  count: "bg-white/25 text-white",
};

export function VenueNav({ items, activity, attendeeName, tellUsMoreHref }: { items: VenueNavItem[]; activity?: VenueActivity; attendeeName?: string; tellUsMoreHref?: string }) {
  const pathname = usePathname() || "";
  return (
    <div className="relative min-w-0 flex-1">
      {/* The strip scrolls on a phone and used to be cut off mid-list with nothing to say so. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-brand-black to-transparent" aria-hidden="true" />
      <nav className="mobile-scrollbar flex items-center gap-1 overflow-x-auto" aria-label="Venue">
        {items.map((item) => {
          const marker = activity ? navMarkerFor(item.surface, activity) : undefined;
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <a
              key={item.surface}
              href={item.href}
              aria-current={current ? "page" : undefined}
              data-nav-surface={item.surface}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold ${current ? "bg-white text-brand-black" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              {item.label}
              {marker ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${current && marker.tone === "count" ? "bg-slate-200 text-slate-700" : TONE[marker.tone]}`} data-nav-marker={item.surface}>{marker.label}</span> : null}
            </a>
          );
        })}
        {attendeeName && tellUsMoreHref ? (
          <a href={tellUsMoreHref} className="ml-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-white/80 hover:border-brand-orange hover:text-white" data-testid="venue-header-attendee">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {attendeeName}
          </a>
        ) : null}
        <span className="w-6 shrink-0" aria-hidden="true" />
      </nav>
    </div>
  );
}
