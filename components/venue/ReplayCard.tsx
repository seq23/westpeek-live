import type { VirtualVenueReplay } from "@/types/virtualVenue";
import { formatReplayDuration } from "@/services/venue";

/**
 * A card says "Watch replay" only when there is a recording to open, and then the whole card opens
 * it. Anything else says plainly why there is nothing to watch yet; it is never labelled available
 * and left dead (the demo venue's three "Available" cards that opened nothing, 7 Nov 2026).
 */
const LABEL: Record<VirtualVenueReplay["status"], string> = {
  available: "Watch replay",
  processing: "Recording in progress",
  not_available: "Recording not posted yet",
  restricted: "Restricted",
};

export function replayIsWatchable(replay: VirtualVenueReplay): replay is VirtualVenueReplay & { playbackUrl: string } {
  return replay.status === "available" && Boolean(replay.playbackUrl);
}

export function ReplayCard({ replay }: { replay: VirtualVenueReplay }) {
  const watchable = replayIsWatchable(replay);
  const label = watchable ? LABEL.available : LABEL[replay.status === "available" ? "not_available" : replay.status];
  const body = (
    <>
      <p className={`text-xs font-semibold uppercase tracking-wide ${watchable ? "text-brand-orange" : "text-slate-500"}`} data-replay-status={watchable ? "available" : replay.status === "available" ? "not_available" : replay.status}>{label}</p>
      <h3 className="mt-2 text-lg font-semibold">{replay.title}</h3>
      <p className="mt-2 text-sm text-slate-600">{formatReplayDuration(replay.durationSeconds)}</p>
    </>
  );
  return watchable ? (
    <a id={replay.id} href={replay.playbackUrl} target="_blank" rel="noopener noreferrer" className="block rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-brand-orange" data-replay-card="watchable">{body}</a>
  ) : (
    <article id={replay.id} className="rounded-3xl border border-slate-200 bg-white p-5" data-replay-card="pending">{body}</article>
  );
}
