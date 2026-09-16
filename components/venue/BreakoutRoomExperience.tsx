import type { VirtualVenueModel } from "@/types/virtualVenue";
import { LiveRoomChat } from "@/components/venue/LiveRoomChat";
import { getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { BreakoutVideoJoinPanel } from "@/components/venue/BreakoutVideoJoinPanel";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { SafeSection } from "@/components/system/SafeSection";

export async function BreakoutRoomExperience({ model, roomId = "general-breakout" }: { model: VirtualVenueModel; roomId?: string }) {
  const [control, identity] = await Promise.all([getAttendeeLiveControlState(model.eventId, "breakout", roomId), getCurrentAttendeeIdentity(model.eventId).catch(() => undefined)]);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Breakout room</p>
        <h1 className="mt-2 text-3xl font-black">Live breakout room</h1>
        <p className="mt-3 text-slate-300">Everyone in this room can talk to each other here. The crew decides when cameras and microphones can go on.</p>
        <BreakoutVideoJoinPanel eventId={model.eventId} roomId={roomId} displayName={identity?.displayName} attendeeId={identity?.attendeeId} cameraAllowed={control.globalCameraEnabled} microphoneAllowed={control.globalMicrophoneEnabled} screenShareAllowed={control.globalScreenShareEnabled} emergencyDisabled={control.emergencyPublishingDisabled} />
      </section>
      <SafeSection label="Breakout chat" render={() => LiveRoomChat({ eventId: model.eventId, roomKind: "breakout", roomId: roomId, title: "Breakout room chat", description: "This chat is only the people in this breakout. The main stage chat is separate." })} />
    </div>
  );
}
