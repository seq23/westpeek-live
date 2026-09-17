import { getEvent, getClient, getRuntimeData } from "@/lib/runtime/getRuntimeData";
import { calculateEventReadiness } from "@/lib/readiness/calculateEventReadiness";
import { ReadinessScore } from "@/components/shared/ReadinessScore";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { formatEventDate, titleize } from "@/lib/utils/format";

/**
 * @seed-view — the demo/seed branch of the event overview and builder pages. Its readiness score
 * and its metric tiles are computed from the compiled fixtures, which is what a demo event is for.
 * A real runtime event never reaches this file: EventOverview counts its own rows instead.
 */
export function EventOverviewSeedView({ eventId }: { eventId: string }) {
  const data = getRuntimeData();
  const event = getEvent(eventId);
  const client = getClient(event.clientId);
  const readiness = calculateEventReadiness(data, event.id);
  const tasks = data.tasks.filter((task) => task.eventId === event.id);
  const approvals = data.approvals.filter((approval) => approval.eventId === event.id);
  const ros = data.runOfShowSegments.filter((segment) => segment.eventId === event.id);

  const links = [
    ["Run of Show", `/app/events/${event.id}/run-of-show`],
    ["Tasks", `/app/events/${event.id}/tasks`],
    ["Crew", `/app/events/${event.id}/crew`],
    ["Speakers", `/app/events/${event.id}/speakers`],
    ["Sponsors", `/app/events/${event.id}/sponsors`],
    ["Client Portal", `/client/${client.slug}/events/${event.id}`],
    ["Producer", `/app/events/${event.id}/producer`],
    ["Venue", `/venue/${event.id}/lobby`],
    ["Report", `/app/events/${event.id}/report`],
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{client.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
            <p className="mt-2 max-w-3xl text-slate-600">{event.description}</p>
            <p className="mt-2 text-sm text-slate-500">{titleize(event.eventType)} · {formatEventDate(event.startAt, event.timezone)} · {event.timezone}</p>
          </div>
          <StatusBadge status={event.status} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Open tasks" value={tasks.filter((t) => t.status !== "complete").length} />
        <MetricCard label="Approvals" value={approvals.filter((a) => !["approved", "locked"].includes(a.status)).length} />
        <MetricCard label="ROS segments" value={ros.length} />
        <MetricCard label="Venue enabled" value={event.venueEnabled ? "Yes" : "No"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <ReadinessScore score={readiness.overallScore} label="Overall readiness" />
        <SectionCard title="Readiness breakdown">
          <div className="grid gap-3 md:grid-cols-2">
            {readiness.categories.map((category) => (
              <div key={category.key} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{category.label}</p>
                  <StatusBadge status={category.status} tone={category.status === "ready" ? "good" : category.status === "blocked" ? "bad" : "warn"} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{category.score}% · {category.missingItems[0] ?? category.recommendedActions[0]}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Event modules">
        <div className="grid gap-3 md:grid-cols-3">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="rounded-2xl border border-slate-200 p-4 font-medium hover:bg-slate-50">{label}</a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
