import { getContractorAssignmentsForEvent, getEvent, getRunOfShowForEvent, getSpeakersForEvent, getVendorAssignmentsForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { formatEventDate } from "@/lib/utils/format";
import { CrewLiveModerationDeck } from "@/components/moderation/CrewLiveModerationDeck";
import { getEventShow } from "@/services/run-of-show/eventShow";
import { listEventIncidents } from "@/services/incidents/incidentLog";

/**
 * @seed-view — the demo/seed branch of the event command centre. Its live segment, cues, speaker
 * readiness and crew/vendor counts are the demo summit's fixtures, which is what a demo event is
 * for. A real runtime event goes to ProductionCommandCenter's runtime branch instead.
 */
export async function ProductionCommandCenterSeedView({ eventId, rosterSearch = "", diagnose }: { eventId: string; rosterSearch?: string; diagnose?: string }) {
  const event = getEvent(eventId);
  const segments = getRunOfShowForEvent(event.id);
  // What is on comes from the one shared reading (clock + producer marks), not from row order.
  const [show, incidents] = await Promise.all([getEventShow(eventId), listEventIncidents(eventId)]);
  const current = segments.find((segment) => segment.id === show.current?.segment.id);
  const upcomingIds = show.segments.filter((run) => run.state === "upcoming").map((run) => run.segment.id).slice(0, 3);
  const next = segments.filter((segment) => upcomingIds.includes(segment.id));
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const speakers = getSpeakersForEvent(event.id);
  const crew = getContractorAssignmentsForEvent(event.id);
  const vendors = getVendorAssignmentsForEvent(event.id);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-slate-300">Live production command center · demo event</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Live cockpit for producers: video rooms, moderation, polling, recording readiness, and incident workflows.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Current segment" value={current?.publicTitle ?? "None"} note={current ? formatEventDate(current.startAt, event.timezone) : undefined} />
        <MetricCard label="Speakers" value={`${speakers.filter((s) => s.readinessStatus === "ready").length}/${speakers.length}`} note="ready" />
        <MetricCard label="Crew confirmed" value={`${crew.filter((c) => c.status === "confirmed").length}/${crew.length}`} />
        <MetricCard label="Vendors" value={`${vendors.filter((v) => ["confirmed", "complete"].includes(v.status)).length}/${vendors.length}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Live segment">
          {current ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{formatEventDate(current.startAt, event.timezone)} · {current.room}</p>
                    <h2 className="mt-1 text-2xl font-semibold">{current.publicTitle}</h2>
                    <p className="mt-2 text-slate-600">{current.clientFacingDescription}</p>
                  </div>
                  <StatusBadge status={current.readinessStatus} tone={current.readinessStatus === "ready" ? "good" : "warn"} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold">Producer notes</p>
                  <p className="mt-2 text-sm text-slate-600">{current.producerNotes}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold">Technical cues</p>
                  <p className="mt-2 text-sm text-slate-600">{current.technicalCues}</p>
                </div>
              </div>
            </div>
          ) : (
            <p data-testid="command-no-current-segment">Nothing is on right now. The clock and the producer&rsquo;s marks on the run of show decide what is.</p>
          )}
        </SectionCard>

        <SectionCard title="Next cues">
          <div className="space-y-3">
            {next.map((segment) => (
              <div key={segment.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{formatEventDate(segment.startAt, event.timezone)}</p>
                <p className="font-semibold">{segment.publicTitle}</p>
                <p className="text-sm text-slate-600">{segment.technicalCues}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <SectionCard title="Speaker readiness">
          <div className="space-y-3">
            {speakers.map((speaker) => (
              <div key={speaker.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{speaker.name}</p>
                  <StatusBadge status={speaker.readinessStatus} tone={speaker.readinessStatus === "ready" ? "good" : "warn"} />
                </div>
                <p className="mt-1 text-sm text-slate-500">Tech check: {speaker.techCheckStatus}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Room status">
          <div className="space-y-3">
            {["Main Stage", "Breakout A", "Expo Booths", "Networking"].map((room, index) => (
              <div key={room} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{room}</p>
                  <StatusBadge status={index === 0 ? "scheduled" : "standby"} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Incident log" eyebrow={openIncidents.length ? `${openIncidents.length} open` : "clear"}>
          <div className="space-y-3">
            {openIncidents.length ? openIncidents.slice(0, 3).map((incident) => (
              <div key={incident.id} className="rounded-xl bg-slate-50 p-3">
                <p className="font-medium">{incident.title}</p>
                <p className="text-sm text-slate-500">{incident.severity}</p>
              </div>
            )) : <p className="text-sm text-slate-600">No open incident on this event.</p>}
            <a href={`/app/events/${eventId}/incidents`} className="block w-full rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-medium text-white">Open the incident log</a>
          </div>
        </SectionCard>
      </div>

      <CrewLiveModerationDeck eventId={event.id} search={rosterSearch} searchAction={`/app/events/${eventId}`} diagnose={diagnose} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <SectionCard title="Q&A queue">
          <p className="text-sm text-slate-600">Question approval and stage-pinning controls.</p>
        </SectionCard>
        <SectionCard title="Poll control">
          <p className="text-sm text-slate-600">Launch and close poll controls.</p>
        </SectionCard>
      </div>
    </div>
  );
}
