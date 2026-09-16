import { SpeedNetworkingLive } from "@/components/venue/SpeedNetworkingLive";
import { joinSpeedNetworkingQueueAction, leaveSpeedNetworkingQueueAction, nextSpeedNetworkingMatchAction } from "@/lib/actions/networkingActions";
import { getCurrentAttendeeIdentity, getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { getMyNetworkingState } from "@/services/speed-networking/speedNetworkingService";

/**
 * Server entry for the networking page: the attendee's real queue state, then the live client
 * takes over (polls, match room, next, end). A registered attendee who is not in the queue gets
 * the real Join queue form (server action, works without JS); everything after that is live.
 */
export async function SpeedNetworkingQueuePanel({ eventId }: { eventId: string }) {
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  let state: Awaited<ReturnType<typeof getMyNetworkingState>>;
  try {
    state = await getMyNetworkingState(eventId, identity?.attendeeId);
  } catch (error) {
    console.warn("networking panel unavailable", error instanceof Error ? error.message : String(error));
    return (
      <section data-testid="networking-queue-panel" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900" data-state="unavailable">
        <h2 className="text-xl font-black">Networking is taking a break</h2>
        <p className="mt-2 text-sm">The queue is not available right now. The stage and chat still work — try again in a minute.</p>
      </section>
    );
  }
  const showJoinForm = Boolean(identity) && state.status === "idle";
  // Matching uses topics and a one-liner; ask for just those, inline, when they are missing — not the whole profile.
  const profile = identity ? await getCurrentAttendeeProfile(eventId).catch(() => undefined) : undefined;
  const needsTopics = Boolean(profile) && !(profile?.topicsOfInterest || []).length;
  return (
    <section data-testid="networking-queue-panel" className="space-y-4">
      {showJoinForm ? (
        <form action={joinSpeedNetworkingQueueAction} className="rounded-3xl bg-white p-6 shadow-sm" data-testid="attendee-networking-queue-form">
          <input type="hidden" name="eventId" value={eventId} />
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Speed networking</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Meet another attendee, {state.matchMinutes} minutes at a time</h3>
          <p className="mt-1 text-sm text-slate-600">{state.queueSize} {state.queueSize === 1 ? "person is" : "people are"} waiting right now. Joining as {identity?.displayName}{identity?.company ? ` · ${identity.company}` : ""}. You are paired with the longest-waiting person you have not met; camera and mic come on in your 1:1 room with a timer.</p>
          {needsTopics ? (
            <div className="mt-4 grid gap-2 rounded-2xl border border-brand-orange/40 bg-brand-orangeSoft p-3" data-testid="networking-topics-gate">
              <p className="text-sm font-black text-slate-950">First, two things matching uses</p>
              <label className="text-xs font-bold text-slate-700">Topics you care about<textarea name="topicsOfInterest" required placeholder="AI, fundraising, hiring — one per line" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" data-testid="networking-topics-input" /></label>
              <label className="text-xs font-bold text-slate-700">One line on who you want to meet<input name="networkingGoals" placeholder="Founders raising a seed round" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" data-testid="networking-goal-input" /></label>
            </div>
          ) : null}
          <button type="submit" className="mt-4 min-h-12 rounded-full bg-slate-950 px-6 text-base font-black text-white" data-testid="networking-join">Join queue</button>
        </form>
      ) : null}
      <SpeedNetworkingLive eventId={eventId} initial={{ ...state, registered: Boolean(identity), attendeeId: identity?.attendeeId || null }} serverJoinForm={showJoinForm} joinAction={joinSpeedNetworkingQueueAction} nextAction={nextSpeedNetworkingMatchAction} leaveAction={leaveSpeedNetworkingQueueAction} />
    </section>
  );
}
