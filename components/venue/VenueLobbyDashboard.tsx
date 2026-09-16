import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import type { VirtualVenueModel } from "@/types/virtualVenue";
import { buildVenueLobbySections } from "@/services/venue";
import { EMPTY_VENUE_ACTIVITY, getVenueActivity } from "@/services/venue/venueActivityService";
import { createInitialRoomFallbackState, getRoomFallbackState } from "@/services/video/roomFallbackService";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { FallbackActiveBanner } from "@/components/venue/FallbackActiveBanner";
import { MobileExperienceWarning } from "@/components/venue/MobileExperienceWarning";
import { SupportEscalationPanel } from "@/components/venue/SupportEscalationPanel";
import { UnsupportedBrowserWarning } from "@/components/venue/UnsupportedBrowserWarning";
import { FirstVisitCoachStrip } from "@/components/venue/FirstVisitCoachStrip";
import { RegistrationContinuityNote } from "@/components/venue/RegistrationContinuityNote";
import { VenueWelcome } from "@/components/venue/VenueWelcome";
import { EditAttendeeProfilePanel } from "@/components/venue/EditAttendeeProfilePanel";
import { NetworkingOpenNow } from "@/components/venue/NetworkingOpenNow";
import { RegisterToTakePart } from "@/components/venue/RegisterToTakePart";
import { VenueEmptyState } from "@/components/venue/VenueEmptyState";
import { VenueStatusBar } from "@/components/venue/VenueStatusBar";
import { SafeSection } from "@/components/system/SafeSection";
import { SessionCard } from "./SessionCard";
import { BreakoutRoomCard } from "./BreakoutRoomCard";
import { SponsorBoothCard } from "./SponsorBoothCard";

export async function VenueLobbyDashboard({ model, saved = false, justReturned = false }: { model: VirtualVenueModel; saved?: boolean; justReturned?: boolean }) {
  const sections = buildVenueLobbySections(model);
  const profile = await getCurrentAttendeeProfile(model.eventId).catch(() => undefined);
  const activity = await getVenueActivity(model).catch(() => EMPTY_VENUE_ACTIVITY);
  const fallbackState = await getRoomFallbackState(model.eventId, "main_stage").catch(() => createInitialRoomFallbackState(model.eventId, "main_stage"));
  const base = `/venue/${model.eventId}`;

  return (
    <div className="space-y-6">
      <AnalyticsBeacon eventId={model.eventId} kind="attendee_joined_lobby" />
      <FallbackActiveBanner state={fallbackState} />
      <UnsupportedBrowserWarning />
      <MobileExperienceWarning />

      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">You are in the lobby</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">Welcome to {model.eventName}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{activity.stageLive ? "The show is live on the main stage. Head there first; everything else can wait." : "The show plays on the main stage. Until it starts, have a look around."}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={sections.heroCta} className="min-h-12 rounded-full bg-slate-950 px-6 text-sm font-black leading-[3rem] text-white">{activity.stageLive ? "Watch the show" : "Go to the main stage"}</a>
          <a href={`${base}/networking`} className="min-h-12 rounded-full border border-slate-300 px-6 text-sm font-black leading-[3rem]">Meet someone</a>
          <a href={`${base}/help`} className="min-h-12 rounded-full border border-slate-300 px-6 text-sm font-black leading-[3rem]">Get help</a>
        </div>
        <div className="mt-5">
          <SafeSection label="Registration" render={() => RegistrationContinuityNote({ eventId: model.eventId, justReturned })} />
        </div>
      </section>

      <VenueWelcome eventId={model.eventId} live={activity.stageLive} networkingOpen={activity.networkingOpen} />
      <NetworkingOpenNow eventId={model.eventId} activity={activity} />
      <RegisterToTakePart eventId={model.eventId} registered={Boolean(profile)} returnTo={`${base}/lobby`} />
      <VenueStatusBar model={model} activity={activity} />

      <SafeSection label="Tell us more" render={() => EditAttendeeProfilePanel({ eventId: model.eventId, returnTo: `${base}/lobby`, saved })} />

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-black">On now</h3>
          <div className="space-y-3">{sections.liveNow.length ? sections.liveNow.map((session) => <SessionCard key={session.id} session={session} />) : <VenueEmptyState title="Nothing is on yet." line="When the show starts it appears here and on the main stage. Nothing to do but wait." actionHref={`${base}/stage`} actionLabel="Open the main stage" testId="lobby-live-empty" />}</div>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-black">Coming up</h3>
          <div className="space-y-3">{sections.upNext.length ? sections.upNext.map((session) => <SessionCard key={session.id} session={session} />) : <VenueEmptyState title="Nothing else is scheduled." line="Today is one session on the main stage. The running order lower down this page shows the whole shape of it." testId="lobby-upnext-empty" />}</div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-black">Breakout rooms</h3>
        <div className="grid gap-3 md:grid-cols-3">{sections.breakouts.length ? sections.breakouts.map((room) => <BreakoutRoomCard key={room.id} room={room} />) : <div className="md:col-span-3"><VenueEmptyState title="No breakout rooms at this event." line="Breakouts are small video rooms alongside the main show. This event does not have any, so the conversation is in the chat on the stage." actionHref={`${base}/stage`} actionLabel="Go to the stage" testId="lobby-breakouts-empty" /></div>}</div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-black">Sponsor booths</h3>
        <div className="grid gap-3 md:grid-cols-4">{sections.booths.length ? sections.booths.map((booth) => <SponsorBoothCard key={booth.id} booth={booth} />) : <div className="md:col-span-4"><VenueEmptyState title="No sponsor booths at this event." line="When an event has sponsors, their booths sit here with a way to talk to them. The action today is on the main stage." actionHref={`${base}/stage`} actionLabel="Go to the stage" testId="lobby-booths-empty" /></div>}</div>
      </section>

      <SupportEscalationPanel eventId={model.eventId} />
    </div>
  );
}
