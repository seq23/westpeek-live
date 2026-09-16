import { getRuntimeData, getContractorAssignmentsForEvent, getEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatEventDate } from "@/lib/utils/format";

export function ContractorBench() {
  const data = getRuntimeData();

  return (
    <SectionCard title="Contractor bench" eyebrow="External crew">
      <div className="grid gap-4 md:grid-cols-2">
        {data.contractors.map((contractor) => (
          <div key={contractor.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{contractor.name}</p>
                <p className="text-sm text-slate-500">{contractor.primaryRole} · {contractor.timezone}</p>
              </div>
              <StatusBadge status={contractor.status} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{contractor.skills.join(", ")}</p>
            <p className="mt-2 text-xs text-slate-400">Internal only: {contractor.rateType} {contractor.rateAmount ? `$${contractor.rateAmount}` : ""}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function EventCrewBoard({ eventId }: { eventId: string }) {
  const data = getRuntimeData();
  const event = getEvent(eventId);
  const assignments = getContractorAssignmentsForEvent(event.id);

  return (
    <SectionCard title={`${event.name} crew`} eyebrow="Assignments">
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const contractor = data.contractors.find((item) => item.id === assignment.contractorId);
          return (
            <div key={assignment.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{contractor?.name}</p>
                  <p className="text-sm text-slate-500">{assignment.role} · call time {formatEventDate(assignment.callTimeAt, event.timezone)}</p>
                </div>
                <StatusBadge status={assignment.status} tone={assignment.status === "confirmed" ? "good" : "warn"} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{assignment.sharedNotes}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

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
