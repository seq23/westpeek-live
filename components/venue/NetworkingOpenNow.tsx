import type { VenueActivity } from "@/services/venue/venueActivityService";

/**
 * Point at the thing when it becomes relevant. One unobtrusive line on the lobby and the stage
 * while networking is actually open, linking straight in; when the crew closes networking the
 * line is gone. Nothing is rendered on a guess — `open` comes from the crew's own setting.
 */
export function NetworkingOpenNow({ eventId, activity }: { eventId: string; activity: VenueActivity }) {
  if (!activity.networkingOpen) return null;
  const minutes = activity.networkingMatchMinutes;
  const waiting = activity.networkingQueueSize;
  return (
    <a href={`/venue/${eventId}/networking`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 hover:border-emerald-500" data-testid="networking-open-now">
      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">Networking is open</span>
      <span className="font-semibold">We pair you with one other attendee for {minutes} minutes on camera{waiting > 0 ? `, and ${waiting} ${waiting === 1 ? "person is" : "people are"} waiting now` : ""}.</span>
      <span className="font-black underline">Join the queue</span>
    </a>
  );
}
