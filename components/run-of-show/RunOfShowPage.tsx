import { SectionCard } from "@/components/shared/SectionCard";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { RunOfShowSeedView } from "@/components/run-of-show/RunOfShowSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { listWorkspaceSpeakers, workspaceSegments } from "@/services/events/eventWorkspaceReadModel";
import { formatEventDate } from "@/lib/utils/format";

/**
 * The event's own timeline: the sessions the producer entered, in order, with the speakers who have
 * actually arrived listed beside it.
 *
 * It used to render the seed run-of-show segments, cues and approval states. A Room created a
 * minute earlier told its producer to "bring Drake live after the 30-second bumper" — the demo
 * summit's notes. There are no per-segment producer cues in the store yet, so none are shown: the
 * cue cards a producer really writes live per SPEAKER on the crew deck, and the page says so.
 */
export async function RunOfShowPage({ eventId }: { eventId: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <RunOfShowSeedView eventId={eventId} />;
  const segments = workspaceSegments(event);
  const speakers = await listWorkspaceSpeakers(event.id);

  return (
    <div className="space-y-6" data-testid="run-of-show" data-segments={segments.length}>
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Run of show</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 text-slate-600">This event&rsquo;s own sessions, in order. Edit them on Setup. Producer cues are written per speaker on the crew deck and land on their teleprompter within about five seconds — there are no per-segment cue notes in the store, so none are shown here.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <SectionCard title="Production timeline" eyebrow={`${segments.length} segment${segments.length === 1 ? "" : "s"}`}>
          <div className="space-y-4">
            {segments.map((segment) => (
              <div key={segment.id} className="rounded-2xl border border-slate-200 p-4" data-testid={`ros-segment-${segment.id}`}>
                <p className="text-sm text-slate-500">{formatEventDate(segment.startAt, event.timezone)} · {segment.durationMinutes} min · {segment.room}</p>
                <h3 className="mt-1 text-lg font-semibold">{segment.title}</h3>
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
