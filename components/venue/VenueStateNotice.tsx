import { ReplayCenter } from "@/components/venue/ReplayCenter";
import { VENUE_GATE_MESSAGE, type VenueGate } from "@/services/venue/venueStateGate";
import type { VirtualVenueModel } from "@/types/virtualVenue";

/**
 * What every venue page renders instead of its content when the event is ended, archived, or
 * not open: the join code's own message, the replay center for an ended event, and the way back.
 */
export function VenueStateNotice({ model, gate, isHost }: { model: VirtualVenueModel; gate: Exclude<VenueGate, "open">; isHost: boolean }) {
  const eventId = model.eventId;
  return (
    <div className="space-y-6" data-testid="venue-state-notice" data-gate={gate}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{gate === "ended" ? "Event ended" : gate === "archived" ? "Event archived" : "Event not open"}</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950" data-testid="venue-state-headline">{VENUE_GATE_MESSAGE[gate]}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {gate === "ended" ? "The show is over. Recordings appear in the replay center when production publishes them; chat and the stage are closed." : gate === "archived" ? "The production team has put this event away. Ask them if you were expecting to be here." : "Come back with your event code when the production team opens the event."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {gate === "ended" ? <a href={`/venue/${eventId}/replay`} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white" data-testid="venue-state-replay-link">Open replay center</a> : null}
          <a href="/join" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">Back to Join Event</a>
          {isHost ? <a href={`/app/events/${eventId}`} className="rounded-xl border border-brand-orange px-5 py-3 text-sm font-bold text-brand-orange" data-testid="venue-state-host-link">You are the host · event command center</a> : null}
        </div>
      </section>
      {gate === "ended" ? <ReplayCenter eventId={eventId} replays={model.replays} /> : null}
    </div>
  );
}
