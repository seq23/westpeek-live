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
import { VenueWelcome } from "@/components/venue/VenueWelcome";
import { NetworkingOpenNow } from "@/components/venue/NetworkingOpenNow";
import { RegisterToTakePart } from "@/components/venue/RegisterToTakePart";
import { StageChatSheet } from "@/components/venue/StageChatSheet";
import { requestAttendeeStageAccess } from "@/lib/actions/attendeeLiveActions";
import { attendeeStageStatus } from "@/services/venue/attendeeStageStatus";
import { EMPTY_VENUE_ACTIVITY, getVenueActivity } from "@/services/venue/venueActivityService";
import { SafeSection } from "@/components/system/SafeSection";

export async function MainStageExperience({ model, saved = false }: { model: VirtualVenueModel; saved?: boolean }) {
  const fallbackState = await getRoomFallbackState(model.eventId, "main_stage").catch(() => createInitialRoomFallbackState(model.eventId, "main_stage"));
  const stageStreamState = await getPublicStageStreamState(model.eventId, "main-stage");
  const attendeeLiveControl = await getAttendeeLiveControlState(model.eventId, "main_stage", "main-stage");
  const identity = await getCurrentAttendeeIdentity(model.eventId).catch(() => undefined);
  const attendeeLiveCapability = identity?.attendeeId ? await getAttendeeLiveCapability(model.eventId, "main_stage", "main-stage", identity.attendeeId).catch(() => undefined) : undefined;
  const activity = await getVenueActivity(model).catch(() => EMPTY_VENUE_ACTIVITY);
  const liveSession = model.liveNow[0] || model.sessions[0];
  const stageStatus = { ...attendeeStageStatus({ control: attendeeLiveControl, capability: attendeeLiveCapability, registered: Boolean(identity?.attendeeId) }), attendeeId: identity?.attendeeId || null };
  return (
    <div className="space-y-6">
      <AnalyticsBeacon eventId={model.eventId} kind="attendee_joined_session" subjectId={liveSession?.id || "main_stage"} />
      <FallbackActiveBanner state={fallbackState} />
      {/*
        items-start: the two columns size to their own content. The rail used to be stretched to the
        stage column's height while the chat inside it claimed h-full, so the card under the chat
        overflowed the row and painted on top of My Agenda below the grid (the owner, 16 Sep 2026).
        The rail is now the chat and nothing else; "Tell us more about you" is a full-width section
        under the stage, where a seven-field form has room to render without clipping URLs.
      */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Level 1: the video is the page, so it wears no card. No border, no shadow, no white
            surround competing with it; everything that explains the show is type underneath.
            The player is also FIRST in the DOM — the old header, title block and four stat tiles
            put it about 700px down a 414px screen and a newcomer decided the stage was broken
            (the owner, 16 Sep 2026). */}
        <div className="min-w-0 space-y-4">
          <StagePlayer initialState={stageStreamState} eventId={model.eventId} eventName={model.eventName} stageId="main-stage" viewerRole="attendee" displayName={identity?.displayName || "Registered attendee"} profileId={identity?.attendeeId} initialStageStatus={stageStatus} />
          <div>
            <h1 className="text-xl font-black tracking-[-0.02em] text-balance sm:text-2xl">{liveSession?.title || "Main stage is standing by"}</h1>
            <p className="mt-1 max-w-[65ch] text-sm leading-6 text-slate-600">If the picture refreshes or switches source behind the scenes, stay on this page. It comes back on its own.</p>
          </div>
          <AttendeeStageJoinControls eventId={model.eventId} roomId="main-stage" attendeeId={identity?.attendeeId} initial={stageStatus} requestAction={requestAttendeeStageAccess} />
        </div>
        {/* Level 2: the conversation supports the show. A rail on a wide screen, a bottom sheet on
            a phone, never a column pushed below everything else. */}
        <div className="min-w-0 space-y-4">
          <StageChatSheet><MainStageLiveChat model={model} /></StageChatSheet>
          <RegisterToTakePart eventId={model.eventId} registered={Boolean(identity?.attendeeId)} returnTo={`/venue/${model.eventId}/stage`} />
        </div>
      </div>
      <NetworkingOpenNow eventId={model.eventId} activity={activity} />
      <VenueWelcome eventId={model.eventId} live={activity.stageLive} networkingOpen={activity.networkingOpen} />
      <SafeSection label="Tell us more" render={() => EditAttendeeProfilePanel({ eventId: model.eventId, returnTo: `/venue/${model.eventId}/stage`, saved })} />
      <SafeSection label="My agenda" render={() => MyAgendaPanel({ model: model })} />
      <MainStageAgendaStrip sessions={model.sessions} eventId={model.eventId} />
      {model.sessions.length > 50 ? <SessionFullState /> : null}
    </div>
  );
}
