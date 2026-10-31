import { EventSetupShell } from "@/components/events/setup/EventSetupShell";
import { AgendaSetupPanel } from "@/components/events/setup/SetupPanels";
import { SegmentPeopleEditor } from "@/components/run-of-show/SegmentPeopleEditor";
import { getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { listWorkspaceSpeakers } from "@/services/events/eventWorkspaceReadModel";
import { getEventShow, whoIsOn } from "@/services/run-of-show/eventShow";
import { formatEventDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function EventSetupSubroutePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  const runtime = await ensureRuntimeEvent(resolvedParams.eventId);
  const config = getEventConfigPackage(resolvedParams.eventId);
  const editable = runtime && runtime.source !== "seed" ? runtime : undefined;
  const [show, speakers] = editable ? await Promise.all([getEventShow(editable.id), listWorkspaceSpeakers(editable.id)]) : [undefined, []];
  return (
    <EventSetupShell eventId={resolvedParams.eventId} active="agenda" eyebrow="Setup · Agenda" title="Agenda setup">
      {editable && show ? (
        <section className="space-y-3" data-testid="agenda-segment-people">
          <p className="text-sm text-slate-600">Name who is on in each segment. The run of show, the crew, the client portal and each speaker&rsquo;s own page read it from here.</p>
          {show.segments.map(({ segment }) => (
            <div key={segment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{formatEventDate(segment.startAt, editable.timezone)} · {segment.room}</p>
              <p className="font-semibold">{segment.title}</p>
              <p className="text-sm text-slate-700">{whoIsOn(segment) || "Nobody named yet"}</p>
              <SegmentPeopleEditor eventId={editable.id} segment={segment} speakers={speakers} />
            </div>
          ))}
        </section>
      ) : (
        <AgendaSetupPanel sessions={config.agenda.sessions} />
      )}
    </EventSetupShell>
  );
}
