import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { WorkspaceReadinessList } from "@/components/workspace/WorkspaceEmptyState";
import { EventOverviewSeedView } from "@/components/events/EventOverviewSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { getEventWorkspaceReadModel } from "@/services/events/eventWorkspaceReadModel";
import { formatEventDate, titleize } from "@/lib/utils/format";

/**
 * The one page that answers "where is this event up to?". For a real event every tile and every
 * readiness line is a count of its own rows.
 *
 * It used to render calculateEventReadiness() over the compiled fixtures. An event created a minute
 * earlier scored 87% ready, because every fixture list it filtered came back empty and an empty
 * list scored full marks — approvals 100%, speakers 100%, sponsors 100%. A percentage computed from
 * fixtures is worse than no percentage, so there is no percentage here: "3 of 7 ready", counted.
 */
export async function EventOverview({ eventId }: { eventId: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <EventOverviewSeedView eventId={eventId} />;
  const model = await getEventWorkspaceReadModel(event);

  const links = [
    ["Run of Show", `/app/events/${event.id}/run-of-show`],
    ["Tasks", `/app/events/${event.id}/tasks`],
    ["Crew", `/app/events/${event.id}/crew`],
    ["Speakers", `/app/events/${event.id}/speakers`],
    ["Sponsors", `/app/events/${event.id}/sponsors`],
    ["Client Portal", `/client/${event.clientSlug}/events/${event.id}`],
    ["Producer", `/app/events/${event.id}/producer`],
    ["Venue", `/venue/${event.id}/lobby`],
    ["Report", `/app/events/${event.id}/report`],
  ];

  return (
    <div className="space-y-6" data-testid="event-overview" data-event-source={event.source}>
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{event.clientName}</p>
            <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
            <p className="mt-2 max-w-3xl text-slate-600">{event.description || "No one-line description yet — add one on Setup and attendees see it on the public page."}</p>
            <p className="mt-2 text-sm text-slate-500">{titleize(event.eventType)} · {formatEventDate(event.startAt, event.timezone)} · {event.timezone}</p>
          </div>
          <StatusBadge status={event.status} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Speakers" value={model.speakers.length} note="entered with the speaker code" />
        <MetricCard label="Sponsors" value={model.sponsors.length} note={`${model.sponsors.filter((sponsor) => sponsor.booth?.published).length} booth(s) published`} />
        <MetricCard label="Run-of-show segments" value={model.segments.length} />
        <MetricCard label="Files waiting for review" value={model.assetsInReview} note={`${model.assetsTotal} file(s) in total`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <SectionCard title="Readiness" eyebrow="counted, not estimated">
          <WorkspaceReadinessList items={model.readiness} />
        </SectionCard>
        <SectionCard title="Who has arrived">
          {model.speakers.length || model.sponsors.length ? (
            <ul className="space-y-2" data-testid="overview-arrivals">
              {model.speakers.map((speaker) => (
                <li key={speaker.guestId} className="rounded-2xl bg-slate-50 p-3 text-sm"><strong>{speaker.name}</strong> · speaker · tech check {speaker.techCheck.replaceAll("_", " ")}</li>
              ))}
              {model.sponsors.map((sponsor) => (
                <li key={sponsor.guestId} className="rounded-2xl bg-slate-50 p-3 text-sm"><strong>{sponsor.booth?.boothName || sponsor.company || sponsor.name}</strong> · sponsor · {sponsor.booth?.published ? "booth live" : "no booth yet"}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600" data-testid="overview-arrivals-empty">Nobody has entered with a role code yet. Speakers, sponsors, VIPs and the client each get their own code on Access; they type it, give their name once, and appear here.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Event modules">
        <div className="grid gap-3 md:grid-cols-3">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="rounded-2xl border border-slate-200 p-4 font-medium hover:bg-slate-50">{label}</a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
