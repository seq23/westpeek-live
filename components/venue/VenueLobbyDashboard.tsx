import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import type { VirtualVenueModel } from "@/types/virtualVenue";
import { buildVenueLobbySections } from "@/services/venue";
import { createInitialRoomFallbackState, getRoomFallbackState } from "@/services/video/roomFallbackService";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { FallbackActiveBanner } from "@/components/venue/FallbackActiveBanner";
import { MobileExperienceWarning } from "@/components/venue/MobileExperienceWarning";
import { SupportEscalationPanel } from "@/components/venue/SupportEscalationPanel";
import { UnsupportedBrowserWarning } from "@/components/venue/UnsupportedBrowserWarning";
import { SessionCard } from "./SessionCard";
import { BreakoutRoomCard } from "./BreakoutRoomCard";
import { SponsorBoothCard } from "./SponsorBoothCard";

export async function VenueLobbyDashboard({ model }: { model: VirtualVenueModel }) {
  const sections = buildVenueLobbySections(model);
  const profile = await getCurrentAttendeeProfile(model.eventId).catch(() => undefined);
  const fallbackState = await getRoomFallbackState(model.eventId, "main_stage").catch(() => createInitialRoomFallbackState(model.eventId, "main_stage"));

  return (
    <div className="space-y-6">
      <AnalyticsBeacon eventId={model.eventId} kind="attendee_joined_lobby" />
      <FallbackActiveBanner state={fallbackState} />
      <UnsupportedBrowserWarning />
      <MobileExperienceWarning />

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Lobby</p>
        <h2 className="mt-2 text-3xl font-semibold">Welcome to {model.eventName}</h2>
        <p className="mt-2 max-w-3xl text-slate-600">Start at the main stage, browse sessions, join breakouts, visit sponsors, or enter networking. Fallback and support states are visible before you get stuck.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={sections.heroCta} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Join live session</a>
          {profile ? null : <a href={`/events/${model.eventId}/register`} className="rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-white" data-testid="lobby-register-cta">Register to chat and raise your hand</a>}
          <a href={`/venue/${model.eventId}/networking`} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold">Start networking</a>
          <a href={`/venue/${model.eventId}/help`} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold">Get help</a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-semibold">Live now</h3>
          <div className="space-y-3">{sections.liveNow.length ? sections.liveNow.map((session) => <SessionCard key={session.id} session={session} />) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">No session is live yet. Watch the lobby status bar for updates.</p>}</div>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-semibold">Up next</h3>
          <div className="space-y-3">{sections.upNext.length ? sections.upNext.map((session) => <SessionCard key={session.id} session={session} />) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">No upcoming sessions are currently configured.</p>}</div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Breakouts</h3>
        <div className="grid gap-3 md:grid-cols-3">{sections.breakouts.length ? sections.breakouts.map((room) => <BreakoutRoomCard key={room.id} room={room} />) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Breakout rooms are not open.</p>}</div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Expo</h3>
        <div className="grid gap-3 md:grid-cols-4">{sections.booths.length ? sections.booths.map((booth) => <SponsorBoothCard key={booth.id} booth={booth} />) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Sponsor expo is not configured for this event.</p>}</div>
      </section>

      <SupportEscalationPanel eventId={model.eventId} />
    </div>
  );
}
