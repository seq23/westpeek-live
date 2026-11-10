import Link from "next/link";
import { LIVEKIT_DASHBOARD_URL } from "@/lib/capacity/capacityPlans";
import type { EventPlanWarning } from "@/services/capacity/livekitPlanFitService";

/**
 * The detail behind the red banner, on /app/capacity: each event that will not fit, each service
 * that falls short for it and why, and how to clear it. Renders nothing when every event fits.
 */
export function PlanShortfallList({ warnings }: { warnings: EventPlanWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900" data-testid="plan-shortfalls" data-code="PLAN_TOO_SMALL">
      <h2 className="text-xl font-black tracking-tight">Upgrade these before the show</h2>
      <ul className="mt-3 space-y-4 text-sm">
        {warnings.map(({ event, shortfalls, runMinutes, expectedAudience }) => (
          <li key={event.id} data-testid={`plan-shortfalls-${event.id}`} data-services={shortfalls.map((item) => item.service).join(",")}>
            <Link className="font-black underline" href={`/app/events/${event.id}`}>{event.name}</Link>
            <span className="text-red-800"> · {runMinutes} minutes · {expectedAudience} registered</span>
            <ul className="mt-1 space-y-1 pl-4">
              {shortfalls.map((item) => (
                <li key={item.service}>
                  <span className="font-semibold">{item.planRecorded ? `${item.service}: ${item.current} → ${item.upgradeTo}.` : `${item.service}: plan not recorded.`}</span> {item.reasons.join(" ")}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        LiveKit: change the plan in the <a className="font-black underline" href={LIVEKIT_DASHBOARD_URL} target="_blank" rel="noreferrer">LiveKit dashboard ›</a>, then set the LiveKit tier in <Link className="font-black underline" href="/app/settings">Settings ›</Link>. Zoom, Resend and StreamYard: upgrade on their own sites, then tell whoever looks after the app to record the new plan, and the line goes away.
      </p>
    </section>
  );
}
