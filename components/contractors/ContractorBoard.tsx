import { getRuntimeData } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { formatEventDate } from "@/lib/utils/format";

/**
 * The crew portal at /crew, still on the compiled demo fixtures. ContractorBench and
 * EventCrewBoard lived here too until 16 Sep 2026; /app/contractors and an event's Contractors
 * page are real rows now (components/suppliers/*), so the seed versions are gone.
 */
export function ContractorPortalDashboard() {
  const data = getRuntimeData();
  const assignment = data.contractorAssignments[0];
  const event = data.events.find((item) => item.id === assignment.eventId);
  const tasks = data.tasks.filter((task) => assignment.assignedTaskIds.includes(task.id));

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-sm text-slate-300">Crew portal</p>
        <h1 className="mt-2 text-3xl font-semibold">{event?.name}</h1>
        <p className="mt-2 text-slate-300">You only see assigned tasks, call time, and relevant production notes.</p>
      </div>
      <SectionCard title="Your call sheet">
        <p className="text-sm text-slate-600">Role: {assignment.role}</p>
        <p className="text-sm text-slate-600">Call time: {formatEventDate(assignment.callTimeAt, event?.timezone)}</p>
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{assignment.sharedNotes}</p>
      </SectionCard>
      <SectionCard title="Assigned tasks">
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl bg-slate-50 p-3">
              <p className="font-medium">{task.title}</p>
              <p className="text-sm text-slate-500">{task.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
