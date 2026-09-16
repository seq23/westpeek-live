import { AttendeeLiveRoster } from "@/components/moderation/AttendeeLiveRoster";
import { ChatModerationQueue } from "@/components/moderation/ChatModerationQueue";
import { EndShowControl } from "@/components/moderation/EndShowControl";
import { StreamYardIngressPanel } from "@/components/testing/StreamYardIngressPanel";
import { LiveRoomControlForms } from "@/components/moderation/LiveRoomControlForms";
import { SpeakerRosterPanel } from "@/components/moderation/SpeakerRosterPanel";

/**
 * Where the crew is: the pending requests + roster, the chat moderation queue, and the room-wide
 * live controls, as one deck. Rendered on /crew/events/[id], /app/events/[id], and the testing
 * console so the permit / revoke / hide / silence / lock decisions never live only on a
 * diagnostics page. Owner, operator, and event-scoped crew cookies may act; attendees never.
 */
export async function CrewLiveModerationDeck({ eventId, search, searchAction, includeRoomControls = true, includeStreamConsole = true }: { eventId: string; search?: string; searchAction: string; includeStreamConsole?: boolean; includeRoomControls?: boolean }) {
  return (
    <div className="space-y-6" data-testid="crew-live-moderation-deck">
      {includeStreamConsole ? (
        <section className="space-y-3" data-testid="crew-go-live">
          <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Go live</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Make the stage live, and move it if the feed fails</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">Generate the RTMP credentials once, paste them into StreamYard → Custom RTMP, and start the broadcast there; the stage flips within seconds. The ladder below moves attendees to a backup room when the feed drops, and back up when it returns.</p>
          </div>
          <StreamYardIngressPanel eventId={eventId} />
        </section>
      ) : null}
      <EndShowControl eventId={eventId} />
      <SpeakerRosterPanel eventId={eventId} />
      <AttendeeLiveRoster eventId={eventId} search={search} searchAction={searchAction} />
      <ChatModerationQueue eventId={eventId} />
      {includeRoomControls ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="crew-live-room-controls">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Room-wide live controls</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Camera, microphone, join approval, and the kill switch</h2>
          <div className="mt-4"><LiveRoomControlForms eventId={eventId} /></div>
        </section>
      ) : null}
    </div>
  );
}
