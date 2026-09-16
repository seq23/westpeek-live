import { CrewInstructionShell } from "@/components/crew/CrewInstructionShell";
import { crewTasks } from "@/lib/crew/crewBriefing";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function CrewTasksPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <CrewInstructionShell eventId={resolvedParams.eventId} active="tasks" eyebrow="Crew Tasks" title="Crew task list">
      <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="crew-task-list">
        <h2 className="text-2xl font-black tracking-tight">Execution checklist</h2>
        <div className="mt-5 space-y-3">
          {crewTasks.map((task, index) => (
            <div key={task} className="flex gap-3 rounded-2xl border border-brand-line p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-black text-xs font-black text-white">{index + 1}</span>
              <p className="text-sm leading-6 text-brand-muted">{task}</p>
            </div>
          ))}
        </div>
      </section>
    </CrewInstructionShell>
  );
}
