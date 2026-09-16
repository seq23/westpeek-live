import type { VirtualVenueSession } from "@/types/virtualVenue";
import { groupSessionsByStatus } from "@/services/venue";
import { SessionCard } from "./SessionCard";
import { VenueBrowse } from "./VenueBrowse";
import { VenueEmptyState } from "./VenueEmptyState";

const EMPTY: Record<string, string> = {
  "On now": "Nothing is playing this minute. The main stage is where it starts.",
  "Coming up": "Nothing else is scheduled after this one.",
  Finished: "Nothing has finished yet. It is all still ahead of you.",
};

export function SessionDirectory({ sessions, eventId }: { sessions: VirtualVenueSession[]; eventId?: string }) {
  const grouped = groupSessionsByStatus(sessions);
  return (
    <VenueBrowse
      eyebrow="Sessions"
      title="Everything on today"
      intro="Times are in your own time zone. Tap any session to open its room."
      count={sessions.length}
      empty={{ title: "No sessions are scheduled.", line: "Everything today happens on the main stage. The running order at the top of every page says what is on.", actionHref: eventId ? `/venue/${eventId}/stage` : undefined, actionLabel: "Go to the main stage", testId: "sessions-empty" }}
    >
      <div className="space-y-6">
        {([["On now", grouped.live], ["Coming up", grouped.upcoming], ["Finished", grouped.completed]] as const).map(([label, rows]) => (
          <section key={label}>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</h3>
            {rows.length ? <div className="grid gap-3 md:grid-cols-2">{rows.map((session) => <SessionCard key={session.id} session={session} />)}</div>
              : <VenueEmptyState title={`Nothing ${label.toLowerCase()}.`} line={EMPTY[label]} testId={`sessions-empty-${label.toLowerCase().replace(/\s+/g, "-")}`} />}
          </section>
        ))}
      </div>
    </VenueBrowse>
  );
}
