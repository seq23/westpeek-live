import { SpeedNetworkingLive } from "@/components/venue/SpeedNetworkingLive";
import { joinSpeedNetworkingQueueAction, leaveSpeedNetworkingQueueAction, nextSpeedNetworkingMatchAction } from "@/lib/actions/networkingActions";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { getMyNetworkingState } from "@/services/speed-networking/speedNetworkingService";

/**
 * Server entry for the networking page: the attendee's real queue state, then the live client
 * takes over (polls, match room, next, end). A registered attendee who is not in the queue gets
 * the real Join queue form (server action, works without JS); everything after that is live.
 */
export async function SpeedNetworkingQueuePanel({ eventId }: { eventId: string }) {
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  const state = await getMyNetworkingState(eventId, identity?.attendeeId);
  const showJoinForm = Boolean(identity) && state.status === "idle";
  return (
    <section data-testid="networking-queue-panel" className="space-y-4">
      {showJoinForm ? (
        <form action={joinSpeedNetworkingQueueAction} className="rounded-3xl bg-white p-6 shadow-sm" data-testid="attendee-networking-queue-form">
          <input type="hidden" name="eventId" value={eventId} />
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Speed networking</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Meet another attendee, {state.matchMinutes} minutes at a time</h3>
          <p className="mt-1 text-sm text-slate-600">{state.queueSize} {state.queueSize === 1 ? "person is" : "people are"} waiting right now. Joining as {identity?.displayName}{identity?.company ? ` · ${identity.company}` : ""}. You are paired with the longest-waiting person you have not met; camera and mic come on in your 1:1 room with a timer.</p>
          <button type="submit" className="mt-4 min-h-12 rounded-full bg-slate-950 px-6 text-base font-black text-white" data-testid="networking-join">Join queue</button>
        </form>
      ) : null}
      <SpeedNetworkingLive eventId={eventId} initial={{ ...state, registered: Boolean(identity), attendeeId: identity?.attendeeId || null }} serverJoinForm={showJoinForm} joinAction={joinSpeedNetworkingQueueAction} nextAction={nextSpeedNetworkingMatchAction} leaveAction={leaveSpeedNetworkingQueueAction} />
    </section>
  );
}
