import { getEvent, getRuntimeData, getTasksForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

/**
 * @seed-view — the demo/seed branch of the tasks page. The demo summit's task board and milestones
 * are fixtures, which is exactly what a demo event is for. A real runtime event has no task table
 * behind it at all, so TaskBoard sends it somewhere honest instead of here.
 */
export function TaskBoardSeedView({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const data = getRuntimeData();
  const tasks = getTasksForEvent(event.id);
  const milestones = data.milestones.filter((milestone) => milestone.eventId === event.id);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Tasks and milestones · demo event</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
      </div>
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <SectionCard title="Milestones">
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="rounded-xl bg-slate-50 p-3">
                <p className="font-medium">{milestone.title}</p>
                <p className="text-sm text-slate-500">Due {milestone.dueAt}</p>
                <div className="mt-2"><StatusBadge status={milestone.status} /></div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Task board">
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{task.title}</h3>
                  <StatusBadge status={task.priority} tone={task.priority === "critical" ? "bad" : task.priority === "high" ? "warn" : "neutral"} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={task.status} />
                  {task.clientVisible ? <StatusBadge status="client visible" tone="good" /> : <StatusBadge status="internal" />}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
