import { SpeedNetworkingLive } from "@/components/venue/SpeedNetworkingLive";
import { allowRepeatSpeedNetworkingMatchAction, joinSpeedNetworkingQueueAction, leaveSpeedNetworkingQueueAction, nextSpeedNetworkingMatchAction, startSpeedNetworkingMatchNowAction } from "@/lib/actions/networkingActions";
import { getCurrentAttendeeIdentity, getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { getMyNetworkingState } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_PRIVACY_PROMISE } from "@/types/speedNetworking";

/**
 * THE action on the networking page, and the only one.
 *
 * It renders inside the hero, immediately under the headline and its opening paragraph, because
 * that is where the decision is made. It used to be last on the page, under the diagram, the four
 * cards, the privacy line and a register box, in a quiet black pill — "why do i have to scroll to
 * join the queue and why is it at the bottom and seem so muted!?" (the owner, 17 Sep 2026).
 *
 * The right action depends on who is reading, and both paths say which one applies before they
 * offer anything:
 *
 *   · a REGISTERED attendee gets the real Join queue form — a server action, so it works before
 *     hydration and without JavaScript — with how many people are already waiting and the name it
 *     will join them under;
 *   · someone NOT registered is told so in the same place, and gets the moment-of-intent ask
 *     (RegisterPointOfUse) which is a Join queue control that opens into what registering needs.
 *     One ask, not two: the general "Keep watching. Want to join in?" card is deliberately NOT on
 *     this page, because a page about joining does not need a second invitation to join.
 *
 * The privacy promise sits with the button in both paths, because it is the last hesitation before
 * pressing, and one constant (SPEED_NETWORKING_PRIVACY_PROMISE) is the only copy of the sentence.
 *
 * There is no second Join queue button further down the page. The action is at the top; a quieter
 * duplicate at the end of the explainer would be the same "two near-identical cards" the owner
 * already walked the page and removed once.
 */
export async function SpeedNetworkingQueuePanel({ eventId }: { eventId: string }) {
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  let state: Awaited<ReturnType<typeof getMyNetworkingState>>;
  try {
    state = await getMyNetworkingState(eventId, identity?.attendeeId);
  } catch (error) {
    console.warn("networking panel unavailable", error instanceof Error ? error.message : String(error));
    return (
      <section data-testid="networking-queue-panel" className="rounded-brand border border-amber-200 bg-amber-50 p-5 text-amber-900" data-state="unavailable">
        <h2 className="text-xl font-black">Networking is taking a break</h2>
        <p className="mt-2 text-sm">The queue is not available right now. The stage and the chat still work. Try again in a minute.</p>
      </section>
    );
  }
  const showJoinForm = Boolean(identity) && state.status === "idle";
  // Matching uses topics and a one-liner; ask for just those, inline, when they are missing — not the whole profile.
  const profile = identity ? await getCurrentAttendeeProfile(eventId).catch(() => undefined) : undefined;
  const needsTopics = Boolean(profile) && !(profile?.topicsOfInterest || []).length;
  return (
    <section data-testid="networking-queue-panel" className="space-y-4" data-registered={identity ? "true" : "false"} data-status={state.status}>
      {showJoinForm ? (
        <form action={joinSpeedNetworkingQueueAction} className="rounded-brand bg-brand-white p-5 shadow-brand sm:p-6" data-testid="attendee-networking-queue-form">
          <input type="hidden" name="eventId" value={eventId} />
          <p className="text-sm font-black text-brand-black" data-testid="networking-who-this-is-for">
            {state.queueSize === 0 ? "Nobody is waiting yet. Join, and you are matched with the next person in." : `${state.queueSize} ${state.queueSize === 1 ? "person is" : "people are"} waiting right now.`}
          </p>
          <p className="mt-1 text-sm text-brand-muted">You are registered, so this is one press. Joining as {identity?.displayName}{identity?.company ? ` · ${identity.company}` : ""}.</p>
          {needsTopics ? (
            <div className="mt-4 grid gap-2 rounded-2xl border border-brand-orange/40 bg-brand-orangeSoft p-3" data-testid="networking-topics-gate">
              <p className="text-sm font-black text-brand-black">First, two things matching uses</p>
              <label className="text-xs font-bold text-brand-black">Topics you care about<textarea name="topicsOfInterest" required placeholder="AI, fundraising, hiring. One per line." className="mt-1 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="networking-topics-input" /></label>
              <label className="text-xs font-bold text-brand-black">One line on who you want to meet<input name="networkingGoals" placeholder="Founders raising a seed round" className="mt-1 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="networking-goal-input" /></label>
            </div>
          ) : null}
          <button
            type="submit"
            className="mt-4 inline-flex min-h-14 items-center rounded-full bg-brand-orange px-8 text-base font-black text-brand-white transition-colors hover:bg-brand-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black"
            data-testid="networking-join"
          >
            Join the queue
          </button>
          <p className="mt-3 text-sm font-bold text-brand-black" data-testid="speed-networking-privacy-promise">{SPEED_NETWORKING_PRIVACY_PROMISE}</p>
        </form>
      ) : null}
      <SpeedNetworkingLive eventId={eventId} initial={{ ...state, registered: Boolean(identity), attendeeId: identity?.attendeeId || null }} serverJoinForm={showJoinForm} joinAction={joinSpeedNetworkingQueueAction} nextAction={nextSpeedNetworkingMatchAction} leaveAction={leaveSpeedNetworkingQueueAction} repeatAction={allowRepeatSpeedNetworkingMatchAction} startAction={startSpeedNetworkingMatchNowAction} />
    </section>
  );
}
