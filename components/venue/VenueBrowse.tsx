import type { ReactNode } from "react";
import { VenueEmptyState } from "./VenueEmptyState";

/**
 * The BROWSE archetype: a venue page that is a list of things. Sessions, people, the expo, replay
 * and breakouts are all this shape, so they share one layout instead of ten bespoke ones, and each
 * gets a real empty state rather than a heading followed by the footer (which is what /expo was).
 *
 * Level 3 type for the page head, level 2 surfaces for the items themselves. No card around the
 * heading: a title does not need a container.
 */
export function VenueBrowse({ eyebrow, title, intro, count, empty, children, testId }: {
  eyebrow: string;
  title: string;
  intro: string;
  count: number;
  empty: { title: string; line: string; actionHref?: string; actionLabel?: string; testId?: string };
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="space-y-5" data-testid={testId} data-venue-archetype="browse">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-balance sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600">{intro}</p>
      </div>
      {count ? children : <VenueEmptyState {...empty} />}
    </div>
  );
}
