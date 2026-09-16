import { CrewInstructionShell } from "@/components/crew/CrewInstructionShell";
import { crewRunOfShow } from "@/lib/crew/crewBriefing";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function CrewRunOfShowPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <CrewInstructionShell eventId={resolvedParams.eventId} active="run-of-show" eyebrow="Crew Run of Show" title="Crew run of show">
      <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="crew-run-of-show">
        <h2 className="text-2xl font-black tracking-tight">Live cue spine</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-brand-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-ash text-xs font-black uppercase tracking-[0.18em] text-brand-muted">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Cue</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Instruction</th>
              </tr>
            </thead>
            <tbody>
              {crewRunOfShow.map((row) => (
                <tr key={row.time + row.cue} className="border-t border-brand-line">
                  <td className="p-3 font-black">{row.time}</td>
                  <td className="p-3">{row.cue}</td>
                  <td className="p-3">{row.owner}</td>
                  <td className="p-3 text-brand-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </CrewInstructionShell>
  );
}
