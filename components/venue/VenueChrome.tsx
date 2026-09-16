import type { ReactNode } from "react";
import { EventChromeStack } from "@/components/command/EventChromeStack";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { commandBarVisibleTo } from "@/lib/navigation/eventCommandSurfaces";
import { venueChromeData } from "@/services/venue/venueChromeData";
import { VenueHeader } from "./VenueHeader";

/**
 * The whole top of a venue page, in one pinned container: the operator's command bar on top, the
 * venue nav directly beneath it as a sub-bar, and nothing else pinned anywhere on the page.
 *
 * It renders from the LAYOUT rather than from the page shell because the command bar is mounted by
 * the layout on every event area, and a bar in the layout plus a nav in the page cannot share a
 * container. The layout passes the bar in; this decides whether it is there, because the sub-bar
 * looks different when it is the whole stack.
 *
 * Fail soft: if the cookie read throws we treat the viewer as a guest, which hides the bar rather
 * than leaking it, and the nav still renders.
 */
export async function VenueChrome({ eventId, commandBar }: { eventId: string; commandBar: ReactNode }) {
  const { model, activity, attendee } = await venueChromeData(eventId);
  const hasCommandBar = await (async () => {
    try {
      return commandBarVisibleTo(await getCrewViewer(eventId));
    } catch {
      return false;
    }
  })();
  return (
    <EventChromeStack eventId={eventId}>
      {hasCommandBar ? commandBar : null}
      <VenueHeader model={model} attendee={attendee} activity={activity} subordinate={hasCommandBar} />
    </EventChromeStack>
  );
}
