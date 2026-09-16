import { CrewBriefingPanel, CrewInstructionShell } from "@/components/crew/CrewInstructionShell";
import { crewBriefing, crewTasks } from "@/lib/crew/crewBriefing";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { CrewLiveModerationDeck } from "@/components/moderation/CrewLiveModerationDeck";

export const dynamic = "force-dynamic";

export default async function CrewEventHomePage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ roster?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <CrewInstructionShell eventId={resolvedParams.eventId} active="home" eyebrow="Crew Briefing" title="Crew show-day command">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-brand-orange">What to do now</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Start here before touching the venue.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-muted">
          This is the crew-facing instruction surface. It delivers the operator-approved briefing, call sheet, run of show,
          task list, fallback rules, and escalation path without giving crew access to the Operator Launchpad.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <a className="rounded-2xl border border-brand-line p-4 text-sm font-bold hover:border-brand-orange hover:text-brand-orange" href={`/crew/events/${resolvedParams.eventId}/call-sheet`}>Open Call Sheet</a>
          <a className="rounded-2xl border border-brand-line p-4 text-sm font-bold hover:border-brand-orange hover:text-brand-orange" href={`/crew/events/${resolvedParams.eventId}/run-of-show`}>Open Run of Show</a>
          <a className="rounded-2xl border border-brand-line p-4 text-sm font-bold hover:border-brand-orange hover:text-brand-orange" href={`/crew/events/${resolvedParams.eventId}/tasks`}>Open Tasks</a>
        </div>
      </section>

      <section className="space-y-3">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Live moderation</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Who is on the stage, who is waiting, and what chat is doing</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">Permit, approve, revoke, silence, hide, and lock from here during the show. The same controls appear on the operator command page.</p>
        </div>
        <CrewLiveModerationDeck eventId={resolvedParams.eventId} search={resolvedSearchParams?.roster || ""} searchAction={`/crew/events/${resolvedParams.eventId}`} />
      </section>

      <CrewBriefingPanel />

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black tracking-tight">Current crew task focus</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-brand-muted">
          {crewTasks.slice(0, 3).map((task) => <li key={task}>• {task}</li>)}
        </ul>
        <p className="mt-5 text-sm text-brand-muted">Escalation: {crewBriefing.escalationEmail}</p>
      </section>
    </CrewInstructionShell>
  );
}
