import Link from "next/link";
import { CommandBarCodes } from "@/components/command/CommandBarCodes";
import { CommandBarCredentials, CommandBarGoLive } from "@/components/command/CommandBarGoLive";
import { COMMAND_CHIP_MUTED, COMMAND_CHIP_STATIC } from "@/components/command/commandChrome";
import { EnterTheRoomMenu } from "@/components/command/EnterTheRoomMenu";
import { EventHealthDot } from "@/components/command/EventHealthDot";
import { EventSwitcherMenu } from "@/components/command/EventSwitcherMenu";
import { StageRequestsToggle } from "@/components/moderation/StageRequestsToggle";
import { SafeSection } from "@/components/system/SafeSection";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { commandBarVisibleTo, crewDeckPath } from "@/lib/navigation/eventCommandSurfaces";
import { findEventRecord, listEventRecords } from "@/services/events/eventRepository";

/**
 * ONE bar at the top of every event-scoped page (plan §2.1). The owner's complaint was page hopping:
 * going live, opening stage requests, grabbing a code and getting into the room were four
 * destinations. They are now four controls on the page you are already on.
 *
 * Owner and operator ONLY. Never an attendee, never plain crew — the bar carries go live, end show,
 * the access codes and the stream key, and an attendee reaching `/venue/**` must not see any of it.
 * `getCrewViewer` already catches its own failures and answers "none", so a broken cookie read
 * hides the bar rather than leaking it.
 *
 * Every section renders through SafeSection: one dead probe or one failed read leaves one named
 * "unavailable" chip and never blanks the bar or the page under it.
 *
 * The bar is NOT sticky on its own any more. It is the top row of the one sticky chrome stack that
 * `EventChromeStack` owns, because two independently pinned bars is exactly how the venue nav ended
 * up sliding over this one on scroll (the owner, /venue/{id}/stage, 16 Sep 2026). The stream
 * credentials are no longer inside it either: they are a panel BELOW the stack that scrolls with
 * the page, so a long credentials row can never pin a third of the screen open.
 */
export async function EventCommandBar({ eventId }: { eventId: string }) {
  const viewer = await getCrewViewer(eventId);
  if (!commandBarVisibleTo(viewer)) return null;

  const [event, events] = await Promise.all([
    findEventRecord(eventId).catch(() => undefined),
    listEventRecords().catch(() => []),
  ]);
  const status = event?.status || "draft";

  return (
    <div className="relative bg-brand-black text-white" data-testid="event-command-bar" data-chrome-bar="command" data-viewer-kind={viewer.kind} data-event-id={eventId} data-status={status}>
      {/* The row is one line that scrolls, never a stack of wrapped lines: three wrapped rows of
          controls plus the sub-bar ran to 135px on a 414px phone and pushed the stage player off
          the first screen. It says it scrolls, the way the nav below it does. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-brand-black via-brand-black/80 to-transparent xl:hidden" aria-hidden="true" data-chrome-overflow-fade="" />
      <div className="mobile-scrollbar mx-auto flex max-w-7xl flex-nowrap items-center gap-1.5 overflow-x-auto px-3 py-1 [&>*]:shrink-0 sm:px-4 xl:flex-wrap xl:overflow-x-visible" data-chrome-bar-row="">
        <SafeSection label="Event switcher" compact render={() => <EventSwitcherMenu eventId={eventId} eventName={event?.name || eventId} events={events.map((item) => ({ id: item.id, name: item.name, status: item.status }))} />} />

        {/* The stack's ONE statement of what the show is doing. The venue nav underneath no longer
            carries a live pill of its own: the two of them disagreed on an ended event. */}
        <span className={`${COMMAND_CHIP_STATIC} uppercase tracking-wide`} data-testid="command-bar-status-pill" data-chrome-live-state="command-bar">{status.replaceAll("_", " ")}</span>

        <SafeSection label="Health" compact render={() => <EventHealthDot eventId={eventId} goLiveHref={`/app/events/${eventId}/publish`} crewDeckHref={crewDeckPath(eventId)} />} />

        <SafeSection label="Go live" compact render={() => CommandBarGoLive({ eventId, viewer })} />

        <SafeSection label="Stage requests" compact render={() => StageRequestsToggle({ eventId, viewer, variant: "bar" })} />

        <EnterTheRoomMenu eventId={eventId} />

        <SafeSection label="Codes" compact render={() => CommandBarCodes({ eventId })} />

        {/* The only two controls on the bar that are links: both are whole pages, not one intention. */}
        <Link href={crewDeckPath(eventId)} className={COMMAND_CHIP_MUTED} data-testid="command-bar-crew-deck">Crew deck</Link>
        <Link href="/manual" className={COMMAND_CHIP_MUTED} data-testid="command-bar-manual">Manual</Link>

        {/* Clear space the fade can sit over, so the last control is never under it. */}
        <span className="w-8 shrink-0 xl:w-0" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * The stream credentials, below the sticky stack rather than inside it.
 *
 * They used to be the last child of the command bar, which meant they were pinned too: the venue
 * nav landed on top of the "Stream credentials" heading at rest, and an open credentials row ate
 * the top of every scroll position. They answer the same question either way, so they scroll.
 *
 * Owner and operator only, resolved here from the cookies rather than taken as a prop, for the same
 * reason the bar does it: this row carries the RTMP URL and the stream key.
 */
export async function EventCommandCredentials({ eventId }: { eventId: string }) {
  const viewer = await getCrewViewer(eventId);
  if (!commandBarVisibleTo(viewer)) return null;
  return <SafeSection label="Stream credentials" compact render={() => CommandBarCredentials({ eventId, viewer })} />;
}
