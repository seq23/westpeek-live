import type { ReactNode } from "react";
import type { VirtualVenueModel } from "@/types/virtualVenue";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { VenueStateNotice } from "@/components/venue/VenueStateNotice";
import { VenueStatePoller } from "@/components/venue/VenueStatePoller";
import { BuildVersionWatchdog } from "@/components/system/BuildVersionWatchdog";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { findEventRecord } from "@/services/events/eventRepository";
import { venueGateFor } from "@/services/venue/venueStateGate";
import { getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import { EMPTY_VENUE_ACTIVITY, type VenueActivity } from "@/services/venue/venueActivityService";
import { venueChromeData } from "@/services/venue/venueChromeData";
import { RunOfShowStrip } from "@/components/venue/RunOfShowStrip";
import { attendeeRunOfShowView } from "@/services/run-of-show/attendeeRunOfShow";

/**
 * Every venue page renders through this shell, so this is where the venue follows the event's
 * state: ended / replay_available (or the stage marked ENDED) → the ended state with the replay
 * center; archived → the archived notice; draft → "not open yet" (a host still previews). The
 * poller refreshes the page when that changes, so End the show reaches an open stage tab.
 *
 * The chrome at the top of the page is NOT here any more: the command bar and the venue nav have to
 * share one pinned container, and the bar is mounted by the layout, so the layout renders both
 * through VenueChrome. The shell reads the same activity through the same per-request cache, so the
 * probe still runs once. What the shell still carries is the running order, opened in place so an
 * attendee never has to leave a live show to see what is next.
 */
export async function VenuePageShell({
  model,
  children,
  showLegalFooter = true,
  surface = "other",
  showRunOfShow = true,
}: {
  model: VirtualVenueModel;
  children: ReactNode;
  showLegalFooter?: boolean;
  surface?: "replay" | "other";
  showRunOfShow?: boolean;
}) {
  // The shell's own reads fail soft too: a store failure here must not take every venue page down;
  // the page renders open and the poller keeps asking.
  let gate: ReturnType<typeof venueGateFor> = "open";
  let isHost = false;
  // A dead activity read costs the nav its markers, never the page.
  let activity: VenueActivity = EMPTY_VENUE_ACTIVITY;
  // Fails soft by rendering nothing: an unreadable schedule must never become an error bar across
  // every venue page.
  const runOfShow = (() => { try { return attendeeRunOfShowView(model.eventId); } catch { return undefined; } })();
  try {
    const [event, stage, actor, viewer, chrome] = await Promise.all([
      findEventRecord(model.eventId).catch(() => undefined),
      getPublicStageStreamState(model.eventId, "main-stage").catch(() => undefined),
      getWorkspaceActor(),
      getCrewViewer(model.eventId),
      venueChromeData(model.eventId).catch(() => undefined),
    ]);
    activity = chrome?.activity || EMPTY_VENUE_ACTIVITY;
    isHost = Boolean(actor) || viewer.isHost;
    gate = venueGateFor({ status: event?.status, stageEnded: stage?.streamStatus === "ENDED", isHost, surface });
  } catch (error) {
    console.warn("venue shell gate unavailable", error instanceof Error ? error.message : String(error));
  }
  return (
    <main className="min-h-screen bg-brand-ash px-4 py-4 text-brand-black sm:px-6 lg:px-8" data-venue-gate={gate}>
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <BuildVersionWatchdog />
        {gate === "open" && showRunOfShow && runOfShow?.total ? <RunOfShowStrip view={runOfShow} eventId={model.eventId} networkingOpen={activity.networkingOpen} /> : null}
        {gate === "open" ? children : <VenueStateNotice model={model} gate={gate} isHost={isHost} />}
        <VenueStatePoller eventId={model.eventId} gate={gate} surface={surface} />
      </div>
      {showLegalFooter ? <LegalFooter variant="venue" /> : null}
    </main>
  );
}
