import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { CrewLiveModerationDeck } from "@/components/moderation/CrewLiveModerationDeck";
import { ProductionCommandCenterSeedView } from "@/components/production/ProductionCommandCenterSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { listWorkspaceSpeakers, workspaceSegments, type WorkspaceSegment } from "@/services/events/eventWorkspaceReadModel";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { formatEventDate } from "@/lib/utils/format";

/** Which of the event's own sessions the clock is inside right now — nothing is "current" before the show. */
function segmentNow(segments: WorkspaceSegment[], at: number) {
  return segments.find((segment) => new Date(segment.startAt).getTime() <= at && at < new Date(segment.endAt).getTime());
}

/**
 * The producer's cockpit for a REAL event. Every tile is this event's own rows: its sessions, the
 * speakers who entered with the speaker code, its incidents, its support requests.
 *
 * It used to show the demo summit's live segment, its speaker readiness and a hard-coded room list
 * on every event. The worst of it was "current segment", which was simply the first seed segment —
 * an event that had not started yet said it was mid-keynote.
 */
export async function ProductionCommandCenter({ eventId, rosterSearch = "", diagnose }: { eventId: string; rosterSearch?: string; diagnose?: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <ProductionCommandCenterSeedView eventId={eventId} rosterSearch={rosterSearch} diagnose={diagnose} />;
  const [speakers, snapshot] = await Promise.all([listWorkspaceSpeakers(event.id), getRuntimeStore().readSnapshot().catch(() => undefined)]);
  const segments = workspaceSegments(event);
  const now = Date.now();
  const current = segmentNow(segments, now);
  const upcoming = segments.filter((segment) => new Date(segment.startAt).getTime() > now).slice(0, 3);
  const rooms = Array.from(new Set(segments.map((segment) => segment.room)));
  const incidents = (snapshot?.incidentEvents || []).filter((item) => item.eventId === event.id && item.status !== "resolved");
  const support = (snapshot?.supportRequests || []).filter((item) => item.eventId === event.id && item.status !== "resolved");
  const onStage = speakers.filter((speaker) => speaker.stage === "on_stage").length;

  return (
    <div className="space-y-6" data-testid="production-command-center" data-event-source={event.source}>
      <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-slate-300">Live production command center</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 max-w-3xl text-slate-300">Everything on this page is this event&rsquo;s own state. Bring speakers on and off stage, moderate chat, and watch the room from the deck below.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Right now" value={current ? current.title : event.status === "live" ? "Between segments" : "Not started"} note={current ? formatEventDate(current.startAt, event.timezone) : `Status: ${event.status.replaceAll("_", " ")}`} />
        <MetricCard label="Speakers on stage" value={`${onStage}/${speakers.length}`} note="entered with the speaker code" />
        <MetricCard label="Open incidents" value={incidents.length} />
        <MetricCard label="Open support requests" value={support.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Live segment">
          {current ? (
            <div className="rounded-2xl border border-slate-200 p-5" data-testid="command-current-segment">
              <p className="text-sm text-slate-500">{formatEventDate(current.startAt, event.timezone)} · {current.room} · {current.durationMinutes} min</p>
              <h2 className="mt-1 text-2xl font-semibold">{current.title}</h2>
            </div>
          ) : (
            <WorkspaceEmptyState
              testId="command-no-current-segment"
              title="Nothing is running right now"
              line="The clock is not inside any of this event's sessions. When it is, the session appears here. Cue cards for each speaker are on their row in the deck below and reach their teleprompter within about five seconds."
              actionHref={`/app/events/${event.id}/run-of-show`}
              actionLabel="Open the run of show"
            />
          )}
        </SectionCard>

        <SectionCard title="Next up" eyebrow={`${upcoming.length} ahead`}>
          {upcoming.length ? (
            <div className="space-y-3" data-testid="command-next-segments">
              {upcoming.map((segment) => (
                <div key={segment.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{formatEventDate(segment.startAt, event.timezone)} · {segment.room}</p>
                  <p className="font-semibold">{segment.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600" data-testid="command-next-segments-empty">Nothing else is scheduled. Sessions are edited on Setup.</p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <SectionCard title="Speaker readiness" eyebrow={`${speakers.length} arrived`}>
          {speakers.length ? (
            <div className="space-y-3" data-testid="command-speakers">
              {speakers.map((speaker) => (
                <div key={speaker.guestId} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{speaker.name}</p>
                    <StatusBadge status={speaker.stage.replaceAll("_", " ")} tone={speaker.stage === "on_stage" ? "good" : "neutral"} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Tech check: {speaker.techCheck.replaceAll("_", " ")}</p>
                </div>
              ))}
            </div>
          ) : (
            <WorkspaceEmptyState testId="command-speakers-empty" title="No speaker yet" line="Send a speaker this event's speaker link and they appear here as soon as they give their name." actionHref={`/app/events/${event.id}/access`} actionLabel="Get the speaker link" />
          )}
        </SectionCard>

        <SectionCard title="Rooms" eyebrow={`${rooms.length} on the timeline`}>
          <div className="space-y-3" data-testid="command-rooms">
            {rooms.map((room) => (
              <div key={room} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <p className="font-medium">{room}</p>
                <StatusBadge status={current?.room === room ? "running" : "standby"} tone={current?.room === room ? "good" : "neutral"} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Incident log" eyebrow={incidents.length ? `${incidents.length} open` : "clear"}>
          {incidents.length ? (
            <div className="space-y-3" data-testid="command-incidents">
              {incidents.map((incident) => (
                <div key={incident.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{incident.title}</p>
                    <StatusBadge status={incident.severity} tone={incident.severity === "critical" || incident.severity === "high" ? "bad" : "warn"} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{incident.details}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600" data-testid="command-incidents-empty">No open incident on this event.</p>
          )}
          <a href={`/app/events/${event.id}/incidents`} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white">Open the incident log</a>
        </SectionCard>
      </div>

      <CrewLiveModerationDeck eventId={event.id} search={rosterSearch} searchAction={`/app/events/${eventId}`} diagnose={diagnose} />
    </div>
  );
}
