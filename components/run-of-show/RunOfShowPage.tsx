import { SectionCard } from "@/components/shared/SectionCard";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { RunOfShowSeedView } from "@/components/run-of-show/RunOfShowSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { listWorkspaceSpeakers } from "@/services/events/eventWorkspaceReadModel";
import { getEventShow, whoIsOn, type EventShow } from "@/services/run-of-show/eventShow";
import { SegmentPeopleEditor } from "@/components/run-of-show/SegmentPeopleEditor";
import { formatEventDate } from "@/lib/utils/format";

/**
 * The event's own timeline: the sessions the producer entered, in order, with the speakers who have
 * actually arrived listed beside it.
 *
 * It used to render the seed run-of-show segments, cues and approval states. A Room created a
 * minute earlier told its producer to "bring Drake live after the 30-second bumper" — the demo
 * summit's notes. Each segment now carries its own people and cue notes (30 Oct 2026), edited
 * right here, and the segment on now is highlighted from the shared show reading.
 */
export async function RunOfShowPage({ eventId, show: given }: { eventId: string; show?: EventShow }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <RunOfShowSeedView eventId={eventId} />;
  const [speakers, show] = await Promise.all([listWorkspaceSpeakers(event.id), given ? Promise.resolve(given) : getEventShow(event.id)]);
  const segments = show.segments.map((run) => ({ ...run.segment, state: run.state }));

  return (
    <div className="space-y-6" data-testid="run-of-show" data-segments={segments.length}>
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Run of show</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 text-slate-600">This event&rsquo;s own sessions, in order, with who is on in each and the cue notes the crew sees. Open &ldquo;Who is on&rdquo; on a segment to name its speakers and host. Speaker cue cards are written per speaker on the crew deck.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <SectionCard title="Production timeline" eyebrow={`${segments.length} segment${segments.length === 1 ? "" : "s"}`}>
          <div className="space-y-4">
            {segments.map((segment) => (
              <div key={segment.id} className={`rounded-2xl border p-4 ${segment.state === "current" ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`} data-testid={`ros-segment-${segment.sessionId || segment.id}`} data-state={segment.state}>
                <p className="text-sm text-slate-500">{segment.state === "current" ? <strong className="text-emerald-800">On now · </strong> : null}{formatEventDate(segment.startAt, event.timezone)} · {segment.durationMinutes} min · {segment.room}</p>
                <h3 className="mt-1 text-lg font-semibold">{segment.title}</h3>
                <p className="mt-1 text-sm text-slate-700" data-testid="ros-segment-people">{whoIsOn(segment) || "Nobody named yet"}</p>
                {segment.cueNotes ? <p className="mt-1 text-sm text-slate-600">Cue: {segment.cueNotes}</p> : null}
                <SegmentPeopleEditor eventId={event.id} segment={segment} speakers={speakers} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Speakers on the day" eyebrow={`${speakers.length} arrived`}>
          {speakers.length ? (
            <ul className="space-y-3 text-sm" data-testid="ros-speakers">
              {speakers.map((speaker) => (
                <li key={speaker.guestId} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium">{speaker.name}</p>
                  <p className="text-slate-500">{speaker.stage.replaceAll("_", " ")} · tech check {speaker.techCheck.replaceAll("_", " ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <WorkspaceEmptyState
              testId="ros-speakers-empty"
              title="No speaker has arrived yet"
              line="Speakers appear against the timeline once one enters with this event's speaker code. Send them the speaker link from Access."
              actionHref={`/app/events/${event.id}/access`}
              actionLabel="Get the speaker link"
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
