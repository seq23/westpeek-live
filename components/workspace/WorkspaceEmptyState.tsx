/**
 * One empty state for the whole event workspace, the venue's sibling (components/venue/
 * VenueEmptyState.tsx) on the crew side of the wall. Before this, an event the owner had just
 * created showed the demo summit's speakers, sponsors and tasks as if they were hers; the pages
 * that did not show fixtures showed a heading and then nothing, which reads as broken.
 *
 * Every list on a real event now says in plain words what would be here and where the action is.
 */
export function WorkspaceEmptyState({ title, line, actionHref, actionLabel, testId }: { title: string; line: string; actionHref?: string; actionLabel?: string; testId?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6" data-testid={testId || "workspace-empty-state"} data-workspace-empty-state="true">
      <p className="text-base font-black text-slate-950">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{line}</p>
      {actionHref && actionLabel ? <a href={actionHref} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white">{actionLabel}</a> : null}
    </div>
  );
}

/**
 * The honest version of a readiness score: the checks that actually have a runtime signal behind
 * them, counted. No percentage is invented for a check the store cannot answer — a page that says
 * "3 of 6 ready" is finished work, a page that says "87%" off empty fixtures is not.
 */
export function WorkspaceReadinessList({ items, testId }: { items: Array<{ id: string; label: string; ready: boolean; detail: string }>; testId?: string }) {
  const ready = items.filter((item) => item.ready).length;
  return (
    <div data-testid={testId || "workspace-readiness"} data-ready={ready} data-total={items.length}>
      <p className="text-2xl font-black text-slate-950">{ready} of {items.length} ready</p>
      <p className="mt-1 text-sm text-slate-600">Counted from this event&rsquo;s own rows. Nothing here is estimated.</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 p-3" data-testid={`workspace-readiness-${item.id}`} data-ready={item.ready ? "true" : "false"}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-slate-900">{item.label}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${item.ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{item.ready ? "ready" : "not yet"}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
