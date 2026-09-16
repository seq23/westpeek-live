import { updateAttendeeLiveControl } from "@/lib/actions/attendeeLiveActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";

/**
 * Room-wide attendee live controls (camera / mic requests, join approval, the emergency kill
 * switch) for the main stage and the general breakout. Shared by the crew console, the event
 * command page, and the testing console.
 */
export async function LiveRoomControlForms({ eventId, viewer: givenViewer }: { eventId: string; viewer?: CrewViewer }) {
  const main = await getAttendeeLiveControlState(eventId, "main_stage", "main-stage");
  const breakout = await getAttendeeLiveControlState(eventId, "breakout", "general-breakout");
  const viewer = givenViewer || await getCrewViewer(eventId);
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="live-room-control-forms">
      <DeniedNote viewer={viewer} action="manage_stage_access" className="md:col-span-2" />
      <GatedForm viewer={viewer} action="manage_stage_access" formAction={updateAttendeeLiveControl} className="rounded-2xl bg-slate-50 p-4">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value="main_stage" /><input type="hidden" name="roomId" value="main-stage" />
        <p className="font-black">Main stage controls</p>
        <label className="mt-3 block text-sm"><input name="globalCameraEnabled" type="checkbox" defaultChecked={main.globalCameraEnabled} /> Allow attendee camera requests</label>
        <label className="mt-2 block text-sm"><input name="globalMicrophoneEnabled" type="checkbox" defaultChecked={main.globalMicrophoneEnabled} /> Allow attendee microphone requests</label>
        <label className="mt-2 block text-sm"><input name="requestRequired" type="checkbox" defaultChecked={main.requestRequired} /> Require crew approval for publishing</label>
        <label className="mt-2 block text-sm"><input name="attendeeJoinRequiresApproval" type="checkbox" defaultChecked={main.attendeeJoinRequiresApproval} /> Require crew permit before attendee can join/watch live stage</label>
        <label className="mt-2 block text-sm"><input name="emergencyPublishingDisabled" type="checkbox" defaultChecked={main.emergencyPublishingDisabled} /> Emergency disable all publishing</label>
        <button className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="save-main-stage-controls">Save main stage controls</button>
      </GatedForm>
      <GatedForm viewer={viewer} action="manage_stage_access" formAction={updateAttendeeLiveControl} className="rounded-2xl bg-slate-50 p-4">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value="breakout" /><input type="hidden" name="roomId" value="general-breakout" />
        <p className="font-black">Breakout controls</p>
        <label className="mt-3 block text-sm"><input name="globalCameraEnabled" type="checkbox" defaultChecked={breakout.globalCameraEnabled} /> Allow breakout cameras</label>
        <label className="mt-2 block text-sm"><input name="globalMicrophoneEnabled" type="checkbox" defaultChecked={breakout.globalMicrophoneEnabled} /> Allow breakout microphones</label>
        <label className="mt-2 block text-sm"><input name="globalScreenShareEnabled" type="checkbox" defaultChecked={breakout.globalScreenShareEnabled} /> Allow screen share</label>
        <label className="mt-2 block text-sm"><input name="attendeeJoinRequiresApproval" type="checkbox" defaultChecked={breakout.attendeeJoinRequiresApproval} /> Require permit before entering breakout live room</label>
        <label className="mt-2 block text-sm"><input name="emergencyPublishingDisabled" type="checkbox" defaultChecked={breakout.emergencyPublishingDisabled} /> Lock breakout publishing</label>
        <button className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="save-breakout-controls">Save breakout controls</button>
      </GatedForm>
    </div>
  );
}
