import { REFERENCE_SHOW, type ServiceCapacity } from "@/lib/capacity/capacityPlans";

/**
 * Every service westpeek.live uses, one row each, worst first against a 90-minute, 200-person show.
 * Phone-first: the row says the service, the plan and the limit that bites; the rest folds away.
 */
function status(row: ServiceCapacity) {
  if (row.showLoad !== null && row.showLoad >= 1) return { label: "Over the limit", tone: "bg-brand-orange text-white" };
  if (!row.planRecorded) return { label: "Plan not recorded", tone: "border border-brand-orange text-brand-orange" };
  if (row.showLoad === null) return { label: "Unknown", tone: "border border-brand-line text-brand-muted" };
  if (row.showLoad >= 0.7) return { label: `${Math.round(row.showLoad * 100)}% of limit`, tone: "bg-brand-charcoal text-white" };
  return { label: "Fine", tone: "bg-brand-ash text-brand-muted" };
}

export function ServiceCapacityList({ rows }: { rows: ServiceCapacity[] }) {
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm" data-testid="service-capacity">
      <h2 className="text-xl font-black tracking-tight">Every service, worst first</h2>
      <p className="mt-1 text-sm text-brand-muted">Measured against a {REFERENCE_SHOW.runMinutes}-minute show for {REFERENCE_SHOW.audience} people. Tap a row for what the plan includes and where the numbers came from.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const badge = status(row);
          return (
            <li key={row.service} className="rounded-2xl border border-brand-line" data-testid="service-capacity-row" data-service={row.service} data-plan-recorded={row.planRecorded ? "true" : "false"}>
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <span className="block font-black text-brand-black">{row.service}</span>
                    <span className="block text-xs text-brand-muted">{row.plan} · {row.cost}</span>
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${badge.tone}`}>{badge.label}</span>
                </summary>
                <div className="space-y-1 border-t border-brand-line p-3 text-sm">
                  <p><strong>First limit:</strong> {row.firstLimit}</p>
                  <p><strong>Past it:</strong> {row.pastIt}</p>
                  <p><strong>Included:</strong> {row.included}</p>
                  <p className="text-xs text-brand-muted">{row.role}. Source: {row.source}</p>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
