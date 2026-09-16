/**
 * One empty state for the whole venue. A blank page reads as broken (the owner walked all nine
 * venue pages on 16 Sep 2026 and /expo rendered a heading and then the footer). Every list says
 * in plain words what would be here and where the action is instead.
 */
export function VenueEmptyState({ title, line, actionHref, actionLabel, testId }: { title: string; line: string; actionHref?: string; actionLabel?: string; testId?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6" data-testid={testId || "venue-empty-state"} data-venue-empty-state="true">
      <p className="text-base font-black text-slate-950">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{line}</p>
      {actionHref && actionLabel ? <a href={actionHref} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white">{actionLabel}</a> : null}
    </div>
  );
}
