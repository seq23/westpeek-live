import type { ReactNode } from "react";
import type { VirtualVenueModel } from "@/types/virtualVenue";
import { VenueHeader } from "./VenueHeader";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { VenueStateNotice } from "@/components/venue/VenueStateNotice";
import { VenueStatePoller } from "@/components/venue/VenueStatePoller";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { findEventRecord } from "@/services/events/eventRepository";
import { venueGateFor } from "@/services/venue/venueStateGate";
import { getPublicStageStreamState } from "@/services/video/stageStreamStateService";

/**
 * Every venue page renders through this shell, so this is where the venue follows the event's
 * state: ended / replay_available (or the stage marked ENDED) → the ended state with the replay
 * center; archived → the archived notice; draft → "not open yet" (a host still previews). The
 * poller refreshes the page when that changes, so End the show reaches an open stage tab.
 */
export async function VenuePageShell({
  model,
  children,
  showLegalFooter = true,
  surface = "other",
}: {
  model: VirtualVenueModel;
  children: ReactNode;
  showLegalFooter?: boolean;
  surface?: "replay" | "other";
}) {
  const [event, stage, actor, viewer] = await Promise.all([
    findEventRecord(model.eventId).catch(() => undefined),
    getPublicStageStreamState(model.eventId, "main-stage").catch(() => undefined),
    getWorkspaceActor(),
    getCrewViewer(model.eventId),
  ]);
  const isHost = Boolean(actor) || viewer.isHost;
  const gate = venueGateFor({ status: event?.status, stageEnded: stage?.streamStatus === "ENDED", isHost, surface });
  return (
    <main className="min-h-screen bg-brand-ash px-4 py-4 text-brand-black sm:px-6 lg:px-8" data-venue-gate={gate}>
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <VenueHeader model={model} />
        {gate === "open" ? children : <VenueStateNotice model={model} gate={gate} isHost={isHost} />}
        <VenueStatePoller eventId={model.eventId} gate={gate} surface={surface} />
      </div>
      {showLegalFooter ? <LegalFooter variant="venue" /> : null}
    </main>
  );
}
