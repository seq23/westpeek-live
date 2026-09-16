import type { VirtualVenueReplay } from "@/types/virtualVenue";
import { formatReplayDuration } from "@/services/venue";

export function ReplayCard({ replay }: { replay: VirtualVenueReplay }) {
  return (
    <article id={replay.id} className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{replay.status.replace(/_/g, " ")}</p>
      <h3 className="mt-2 text-lg font-semibold">{replay.title}</h3>
      <p className="mt-2 text-sm text-slate-600">{formatReplayDuration(replay.durationSeconds)}</p>
    </article>
  );
}
