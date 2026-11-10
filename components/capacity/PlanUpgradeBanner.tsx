import Link from "next/link";
import { planUpgradeBanner, type PlanUpgradeBannerModel } from "@/lib/capacity/planUpgradeBanner";
import { scheduledEventsTooBigForPlan, type EventPlanWarning } from "@/services/capacity/livekitPlanFitService";

/**
 * The red line at the top of every operator screen (the /app shell, the crew console, the
 * launchpad) while an event still to run will not fit the plans we are on. One line, the soonest
 * event, the services to upgrade, "Open ›" to /app/capacity. Renders nothing when everything fits.
 */
export function PlanUpgradeBannerView({ model }: { model: PlanUpgradeBannerModel | null }) {
  if (!model) return null;
  return (
    <div role="alert" data-testid="plan-upgrade-banner" data-code="PLAN_TOO_SMALL" data-services={model.services.join(",")} data-events={model.eventCount} className="bg-red-700 text-white">
      <Link href="/app/capacity" className="mx-auto flex min-h-11 w-full max-w-[1600px] items-center gap-3 px-4 py-2 text-sm font-semibold leading-5 sm:px-6 lg:px-8">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{model.text}</span>
        <span className="shrink-0 underline underline-offset-2">Open ›</span>
      </Link>
    </div>
  );
}

export function planBannerModelFrom(warnings: EventPlanWarning[], now?: Date) {
  return planUpgradeBanner(warnings.map(({ event, shortfalls }) => ({ id: event.id, name: event.name, startAt: event.startAt, shortfalls })), now);
}

/** Fail-soft: a banner that cannot read never takes the page down with it. */
export async function PlanUpgradeBanner() {
  const fit = await scheduledEventsTooBigForPlan().catch((error) => {
    console.warn(`plan banner: could not read the plan check: ${error instanceof Error ? error.message : String(error)}`);
    return { warnings: [] as EventPlanWarning[] };
  });
  return <PlanUpgradeBannerView model={planBannerModelFrom(fit.warnings)} />;
}
