import Link from "next/link";
import { CommandBarCodes } from "@/components/command/CommandBarCodes";
import { CommandBarCredentials, CommandBarGoLive } from "@/components/command/CommandBarGoLive";
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
    <div className="sticky top-0 z-30 mb-4 rounded-b-3xl bg-brand-black text-white shadow-lg" data-testid="event-command-bar" data-viewer-kind={viewer.kind} data-event-id={eventId} data-status={status}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <SafeSection label="Event switcher" compact render={() => <EventSwitcherMenu eventId={eventId} eventName={event?.name || eventId} events={events.map((item) => ({ id: item.id, name: item.name, status: item.status }))} />} />

        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide" data-testid="command-bar-status-pill">{status.replaceAll("_", " ")}</span>

        <SafeSection label="Health" compact render={() => <EventHealthDot eventId={eventId} goLiveHref={`/app/events/${eventId}/publish`} crewDeckHref={crewDeckPath(eventId)} />} />

        <SafeSection label="Go live" compact render={() => CommandBarGoLive({ eventId, viewer })} />

        <SafeSection label="Stage requests" compact render={() => StageRequestsToggle({ eventId, viewer, variant: "bar" })} />

        <EnterTheRoomMenu eventId={eventId} />

        <SafeSection label="Codes" compact render={() => CommandBarCodes({ eventId })} />

        {/* The only two controls on the bar that are links: both are whole pages, not one intention. */}
        <Link href={crewDeckPath(eventId)} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-white hover:bg-white/20" data-testid="command-bar-crew-deck">Crew deck</Link>
        <Link href="/manual" className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-white hover:bg-white/20" data-testid="command-bar-manual">Manual</Link>
      </div>

      <SafeSection label="Stream credentials" compact render={() => CommandBarCredentials({ eventId, viewer })} />
    </div>
  );
}
