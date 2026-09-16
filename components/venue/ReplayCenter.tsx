import type { VirtualVenueReplay } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { ReplayCard } from "./ReplayCard";
import { VenueBrowse } from "./VenueBrowse";

export function ReplayCenter({ eventId, replays }: { eventId: string; replays: VirtualVenueReplay[] }) {
  return (
    <>
      <AnalyticsBeacon eventId={eventId} kind="replay_watched" metadata={{ replayCount: replays.length }} />
      <VenueBrowse
        eyebrow="Replay"
        title="Watch it again"
        intro="Recordings appear here after the show, once they have finished processing."
        count={replays.length}
        empty={{ title: "Nothing to replay yet.", line: "Recordings are posted here once the show has finished and the file is ready. Nothing you need to do.", actionHref: `/venue/${eventId}/stage`, actionLabel: "Back to the main stage", testId: "replay-empty" }}
      >
        <div className="grid gap-4 md:grid-cols-3">{replays.map((replay) => <ReplayCard key={replay.id} replay={replay} />)}</div>
      </VenueBrowse>
    </>
  );
}
