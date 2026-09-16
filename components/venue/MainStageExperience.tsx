import type { VirtualVenueModel } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { FallbackActiveBanner } from "@/components/venue/FallbackActiveBanner";
import { MainStageAgendaStrip } from "@/components/venue/MainStageAgendaStrip";
import { MainStageLiveChat } from "@/components/venue/MainStageLiveChat";
import { SessionFullState } from "@/components/venue/SessionFullState";
import { StagePlayer } from "@/components/video/StagePlayer";
import { AttendeeStageJoinControls } from "@/components/venue/AttendeeStageJoinControls";
import { getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import { getAttendeeLiveCapability, getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { createInitialRoomFallbackState, getRoomFallbackState } from "@/services/video/roomFallbackService";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { MyAgendaPanel } from "@/components/venue/MyAgendaPanel";
import { EditAttendeeProfilePanel } from "@/components/venue/EditAttendeeProfilePanel";
import { FirstVisitCoachStrip } from "@/components/venue/FirstVisitCoachStrip";
import { requestAttendeeStageAccess } from "@/lib/actions/attendeeLiveActions";
import { attendeeStageStatus } from "@/services/venue/attendeeStageStatus";
import { SafeSection } from "@/components/system/SafeSection";

export async function MainStageExperience({ model, saved = false }: { model: VirtualVenueModel; saved?: boolean }) {
  const fallbackState = await getRoomFallbackState(model.eventId, "main_stage").catch(() => createInitialRoomFallbackState(model.eventId, "main_stage"));
  const stageStreamState = await getPublicStageStreamState(model.eventId, "main-stage");
  const attendeeLiveControl = await getAttendeeLiveControlState(model.eventId, "main_stage", "main-stage");
  const identity = await getCurrentAttendeeIdentity(model.eventId).catch(() => undefined);
  const attendeeLiveCapability = identity?.attendeeId ? await getAttendeeLiveCapability(model.eventId, "main_stage", "main-stage", identity.attendeeId).catch(() => undefined) : undefined;
  const liveSession = model.liveNow[0] || model.sessions[0];
  const stageStatus = { ...attendeeStageStatus({ control: attendeeLiveControl, capability: attendeeLiveCapability, registered: Boolean(identity?.attendeeId) }), attendeeId: identity?.attendeeId || null };
  return (
    <div className="space-y-6">
      <AnalyticsBeacon eventId={model.eventId} kind="attendee_joined_session" subjectId={liveSession?.id || "main_stage"} />
      <FallbackActiveBanner state={fallbackState} />
      <FirstVisitCoachStrip eventId={model.eventId} surface="stage" title="First time here?" lines={["Chat: the panel beside the player — post once you have registered.", "Want to speak? Tap Request to join the stage under the player; the crew sees it on their roster.", "When they approve you, Turn on camera and Turn on microphone appear under the player. Nothing goes live until you tap."]} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Main stage</p>
          <h1 className="mt-2 text-3xl font-black">{liveSession?.title || "Main stage is standing by"}</h1>
          <p className="mt-3 max-w-3xl text-slate-300">Production is monitoring the live stream and backup paths. You can stay on this page if the show refreshes or switches behind the scenes.</p>
          <div className="mt-6">
            <StagePlayer initialState={stageStreamState} eventId={model.eventId} stageId="main-stage" viewerRole="attendee" displayName={identity?.displayName || "Registered attendee"} profileId={identity?.attendeeId} initialStageStatus={stageStatus} />
          </div>
          <div className="mt-5">
            <AttendeeStageJoinControls eventId={model.eventId} roomId="main-stage" attendeeId={identity?.attendeeId} initial={stageStatus} requestAction={requestAttendeeStageAccess} />
          </div>
        </section>
        <div className="space-y-4">
          <MainStageLiveChat model={model} />
          <SafeSection label="Tell us more" render={() => EditAttendeeProfilePanel({ eventId: model.eventId, returnTo: `/venue/${model.eventId}/stage`, saved })} />
        </div>
      </div>
      <SafeSection label="My agenda" render={() => MyAgendaPanel({ model: model })} />
      <MainStageAgendaStrip sessions={model.sessions} eventId={model.eventId} />
      {model.sessions.length > 50 ? <SessionFullState /> : null}
    </div>
  );
}
