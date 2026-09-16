import { CrewInstructionShell } from "@/components/crew/CrewInstructionShell";
import { crewBriefing, crewCallTimesFor } from "@/lib/crew/crewBriefing";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

const assignments = [
  ["Crew Lead", "Own crew check-in, escalation, and show-day readiness confirmation."],
  ["Stage Monitor", "Watch the stage player, fallback banner, attendee join controls, and stream health language."],
  ["Chat / Help Monitor", "Watch main-stage chat, help requests, and urgent attendee issues."],
  ["Sponsor / Expo Monitor", "Check sponsor booth surfaces and escalate lead-capture or booth access issues."],
];

export default async function CrewCallSheetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  const callTimes = crewCallTimesFor(await ensureRuntimeEvent(resolvedParams.eventId));
  return (
    <CrewInstructionShell eventId={resolvedParams.eventId} active="call-sheet" eyebrow="Crew Call Sheet" title="Call sheet and assignments">
      <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="crew-call-sheet">
        <h2 className="text-2xl font-black tracking-tight">Show-day call sheet</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <p className="rounded-2xl bg-brand-ash p-4 text-sm"><span className="font-black">Call time:</span><br />{callTimes.callTime}</p>
          <p className="rounded-2xl bg-brand-ash p-4 text-sm"><span className="font-black">Show start:</span><br />{callTimes.showStart}</p>
          <p className="rounded-2xl bg-brand-ash p-4 text-sm"><span className="font-black">Escalation:</span><br />{crewBriefing.escalationEmail}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {assignments.map(([role, instruction]) => (
            <article key={role} className="rounded-2xl border border-brand-line p-4">
              <h3 className="font-black">{role}</h3>
              <p className="mt-2 text-sm leading-6 text-brand-muted">{instruction}</p>
            </article>
          ))}
        </div>
      </section>
    </CrewInstructionShell>
  );
}
