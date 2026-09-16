import { requestAttendeeStageAccess } from "@/lib/actions/attendeeLiveActions";
import type { AttendeeLiveCapability, AttendeeLiveControlState } from "@/types/attendeeLive";
import { evaluateAttendeeLiveAccess } from "@/services/venue/attendeeLivePermissionService";

export function AttendeeStageJoinControls({ eventId, roomId, control, capability, attendeeId }: { eventId: string; roomId: string; control: AttendeeLiveControlState; capability?: AttendeeLiveCapability; attendeeId?: string }) {
  if (!attendeeId) return <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700" data-testid="stage-join-registration-required"><a href={`/events/${eventId}/register`} className="text-brand-orange underline">Register</a> to request crew-controlled approval for camera and microphone access. Guest registration does not publish by default, and crew may revoke or restore access at any time.</div>;
  const access = evaluateAttendeeLiveAccess({ control, capability, roomKind: "main_stage" });
  if (!access.canJoin) return <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-900" data-testid="attendee-live-access-revoked">{access.reason}</div>;
  if (capability?.approvedForStage) return <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900" data-testid="attendee-stage-approved">The crew approved you for the stage: your camera and microphone can go live from the player above. crew can revoke or restore access at any time.</div>;
  if (capability?.requestStatus === "requested") return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900" data-testid="attendee-stage-request-pending">Your request to join the stage is with the crew. Keep watching; this page updates when they decide.</div>;
  if (capability?.canJoinLiveStream) return <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900" data-testid="attendee-live-access-permitted">You are permitted to join this live event. crew can revoke or restore access if needed.</div>;
  if (control.emergencyPublishingDisabled) return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Crew disabled attendee publishing during live operations.</div>;
  if (!control.globalCameraEnabled && !control.globalMicrophoneEnabled) return <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700">Camera/mic joining is currently disabled by crew.</div>;
  const declined = capability?.requestStatus === "declined";
  return (
    <form action={requestAttendeeStageAccess} className="rounded-2xl border border-brand-orange/30 bg-brand-orangeSoft p-4" data-testid="attendee-stage-request-form">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value="main_stage" /><input type="hidden" name="roomId" value={roomId} /><input type="hidden" name="attendeeId" value={attendeeId} />
      {declined ? <p className="mb-2 rounded-xl bg-white/70 p-3 text-xs font-bold text-slate-700" data-testid="attendee-stage-request-declined">The crew declined your last request. You can ask again if the moment changes.</p> : null}
      <p className="text-sm font-black text-slate-950">Want to join the stage?</p><p className="mt-1 text-xs text-slate-600">Main stage camera access is crew-controlled and request-based by default. Watching remains inside the branded event experience unless crew revokes access.</p>
      <button className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">Request to Join Stage</button>
    </form>
  );
}
