import { CrewInstructionShell } from "@/components/crew/CrewInstructionShell";
import { IncidentLog } from "@/components/production/IncidentLog";
import { SafeSection } from "@/components/system/SafeSection";
import { crewRunOfShow, normalizeCrewEventId } from "@/lib/crew/crewBriefing";
import { formatEventTime } from "@/lib/utils/format";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getEventShow, showTimezone, whoIsOn } from "@/services/run-of-show/eventShow";

function badge(state: "done" | "current" | "upcoming" | "skipped", isNext: boolean) {
  if (isNext) return "Next";
  return { done: "Done", current: "On now", upcoming: "", skipped: "Skipped" }[state];
}

/**
 * The crew's run of show is THIS event's segments — time, segment, who is on, cue notes — with
 * the on-now row marked from the shared show reading. It used to be one generic T-60-to-LIVE cue
 * list, the same on every event; those pre-show cues stay as a short header.
 */
export default async function CrewRunOfShowPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const eventId = normalizeCrewEventId(resolvedParams.eventId);
  const show = await getEventShow(eventId);
  const timezone = showTimezone(eventId);
  return (
    <CrewInstructionShell eventId={resolvedParams.eventId} active="run-of-show" eyebrow="Crew Run of Show" title="Crew run of show">
      <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="crew-run-of-show" data-segments={show.total} data-current-segment={show.current?.segment.id || ""}>
        <h2 className="text-2xl font-black tracking-tight">Before the show</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2" data-testid="crew-preshow-cues">
          {crewRunOfShow.map((row) => (
            <li key={row.time + row.cue} className="rounded-2xl border border-brand-line p-3"><strong>{row.time} · {row.cue}</strong> <span className="text-brand-muted">({row.owner})</span><br /><span className="text-brand-muted">{row.note}</span></li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl font-black tracking-tight">The show</h2>
        {show.delay ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="crew-ros-delay">Running about {show.delay.minutes} min behind.</p> : null}
        {show.total ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-brand-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-brand-ash text-xs font-black uppercase tracking-[0.18em] text-brand-muted">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Segment</th>
                  <th className="p-3">Who is on</th>
                  <th className="p-3">Cue notes</th>
                </tr>
              </thead>
              <tbody>
                {show.segments.map((run) => (
                  <tr key={run.segment.id} className={`border-t border-brand-line ${run.state === "current" ? "bg-emerald-50" : ""}`} data-testid="crew-ros-row" data-state={run.state}>
                    <td className="p-3 font-black whitespace-nowrap">{formatEventTime(run.segment.startAt, timezone)}<br /><span className="text-xs font-normal text-brand-muted">{run.segment.durationMinutes} min</span></td>
                    <td className="p-3">{badge(run.state, run.segment.id === show.next?.segment.id) ? <span className="mr-2 rounded-full bg-brand-black px-2 py-0.5 text-[11px] font-black uppercase text-white">{badge(run.state, run.segment.id === show.next?.segment.id)}</span> : null}{run.segment.title}<br /><span className="text-xs text-brand-muted">{run.segment.room}</span></td>
                    <td className="p-3">{whoIsOn(run.segment) || <span className="text-brand-muted">Nobody named yet</span>}</td>
                    <td className="p-3 text-brand-muted">{run.segment.cueNotes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-brand-line p-4 text-sm text-brand-muted" data-testid="crew-ros-empty">No segments on this event yet. The producer adds them in the workspace.</p>
        )}
      </section>
      <SafeSection label="Incident log" render={() => IncidentLog({ eventId })} />
    </CrewInstructionShell>
  );
}
