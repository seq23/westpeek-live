import { AttendeeLiveRoster } from "@/components/moderation/AttendeeLiveRoster";
import { ChatModerationQueue } from "@/components/moderation/ChatModerationQueue";
import { EndShowControl } from "@/components/moderation/EndShowControl";
import { StreamYardIngressPanel } from "@/components/testing/StreamYardIngressPanel";
import { GoLiveCard } from "@/components/stage/GoLiveCard";
import { LiveRoomControlForms } from "@/components/moderation/LiveRoomControlForms";
import { SpeakerRosterPanel } from "@/components/moderation/SpeakerRosterPanel";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { SafeSection } from "@/components/system/SafeSection";

import { HostPanel } from "@/components/events/HostPanel";
import { NetworkingCrewCard } from "@/components/moderation/NetworkingCrewCard";
import { StageRequestsToggle } from "@/components/moderation/StageRequestsToggle";

/**
 * Where the crew is: the pending requests + roster, the chat moderation queue, and the room-wide
 * live controls, as one deck. Rendered on /crew/events/[id], /app/events/[id], and the testing
 * console so the permit / revoke / hide / silence / lock decisions never live only on a
 * diagnostics page. Owner and operator cookies may act on everything; a crew cookie acts only
 * where its role is allowed by `crewActionPermissions` — every section still renders for every
 * role, with the controls the role may not use disabled and the reason on them.
 */
export async function CrewLiveModerationDeck({ eventId, search, searchAction, includeRoomControls = true, includeStreamConsole = true }: { eventId: string; search?: string; searchAction: string; includeStreamConsole?: boolean; includeRoomControls?: boolean }) {
  const viewer = await getCrewViewer(eventId);
  return (
    <div className="space-y-6" data-testid="crew-live-moderation-deck" data-viewer-kind={viewer.kind} data-viewer-role={viewer.role || viewer.kind}>
      <div className="flex justify-end"><a href="/manual" className="rounded-full border border-brand-line px-3 py-1 text-xs font-black text-brand-muted hover:border-brand-orange hover:text-brand-orange" data-testid="crew-manual-link">Manual</a></div>
      <SafeSection label="Stage requests" render={() => StageRequestsToggle({ eventId, viewer })} />
      {includeStreamConsole ? (
        <section className="space-y-3" data-testid="crew-go-live">
          <SafeSection label="Go live" render={() => GoLiveCard({ eventId, viewer, compact: true, returnTo: `/crew/events/${eventId}` })} />
          <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Go live</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Make the stage live, and move it if the feed fails</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">Generate the RTMP credentials once, paste them into StreamYard → Custom RTMP, and start the broadcast there; the stage flips within seconds. The ladder below moves attendees to a backup room when the feed drops, and back up when it returns.</p>
          </div>
          <SafeSection label="Go live" render={() => StreamYardIngressPanel({ eventId, viewer, includeEndShow: false })} />
        </section>
      ) : null}
      <SafeSection label="Host" render={() => HostPanel({ eventId, viewer })} />
      <SafeSection label="End of show" render={() => EndShowControl({ eventId, viewer })} />
      <SafeSection label="Speakers" render={() => SpeakerRosterPanel({ eventId, viewer })} />
      <SafeSection label="Attendee roster" render={() => AttendeeLiveRoster({ eventId, search, searchAction, viewer })} />
      <SafeSection label="Chat moderation" render={() => ChatModerationQueue({ eventId, viewer })} />
      <SafeSection label="Networking" render={() => NetworkingCrewCard({ eventId, viewer })} />
      {includeRoomControls ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="crew-live-room-controls">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Room-wide live controls</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Camera, microphone, join approval, and the kill switch</h2>
          <div className="mt-4"><SafeSection label="Room-wide live controls" render={() => LiveRoomControlForms({ eventId, viewer })} /></div>
        </section>
      ) : null}
    </div>
  );
}
