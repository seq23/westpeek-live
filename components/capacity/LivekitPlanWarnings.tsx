import Link from "next/link";
import type { EventPlanWarning } from "@/services/capacity/livekitPlanFitService";

/**
 * LIVEKIT_PLAN_TOO_SMALL, shown wherever an operator looks before a show: /app/capacity and the
 * operator launchpad. Renders nothing when every scheduled event fits the plan.
 */
export function LivekitPlanWarnings({ warnings }: { warnings: EventPlanWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section className="rounded-3xl border-2 border-brand-orange bg-brand-orangeSoft p-5" data-testid="livekit-plan-too-small" data-code="LIVEKIT_PLAN_TOO_SMALL" role="alert">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">LIVEKIT_PLAN_TOO_SMALL</p>
      <h2 className="mt-2 text-xl font-black tracking-tight">{warnings[0].warning.message}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {warnings.map(({ event, warning }) => (
          <li key={event.id} data-testid={`livekit-plan-too-small-${event.id}`}>
            <Link className="font-black underline" href={`/app/events/${event.id}`}>{event.name}</Link>: {warning.reasons.join(" ")}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        Change the plan in the <a className="font-black underline" href={warnings[0].warning.dashboardUrl} target="_blank" rel="noreferrer">LiveKit dashboard ({warnings[0].warning.dashboardUrl})</a>, then set the LiveKit tier in <Link className="font-black underline" href="/app/settings">Settings</Link>.
      </p>
    </section>
  );
}
