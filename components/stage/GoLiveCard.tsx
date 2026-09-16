import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { EndShowControl } from "@/components/moderation/EndShowControl";
import { SafeSection } from "@/components/system/SafeSection";
import { StreamCredentials } from "@/components/stage/StreamCredentials";
import { getCrewViewer, viewerCan, type CrewViewer } from "@/lib/auth/crewViewer";
import { goLiveAction } from "@/lib/actions/goLiveActions";
import { ladderReadiness } from "@/lib/video/fallbackReadiness";
import { findEventRecord } from "@/services/events/eventRepository";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";

/**
 * Going live, in one card, wherever you are: the event's Publish page, the Owner Console (on the
 * event row and in Live now) and the crew deck all render THIS.
 *
 * It used to take two pages — set the status on Publish, then hunt for the RTMP credentials on the
 * crew deck under a heading called "Backend showrunner fallback console". Now: status, one Go live
 * button that flips the event AND leaves you holding credentials, the URL and key with copy
 * buttons, what to do in StreamYard, which fallback rung is ready, and End the show.
 */
export async function GoLiveCard({ eventId, viewer: givenViewer, compact = false, returnTo }: { eventId: string; viewer?: CrewViewer; compact?: boolean; returnTo?: string }) {
  const [event, state, viewer] = await Promise.all([
    findEventRecord(eventId),
    getOperatorStageStreamState(eventId, "main-stage").catch(() => undefined),
    givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId),
  ]);
  const hasCredentials = Boolean(state?.livekitStreamKey && state?.livekitIngressUrl);
  const status = event?.status || "draft";
  const ended = status === "ended" || status === "replay_available" || Boolean(state?.operatorMarkedShowEnded);
  const live = status === "live";
  const fallback = ladderReadiness().find((rung) => rung.source === "CLOUDFLARE_STREAM");
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm" data-testid="go-live-card" data-status={status} data-has-credentials={hasCredentials ? "true" : "false"} data-ended={ended ? "true" : "false"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Go live</p>
          <h2 className="mt-1 text-xl font-black text-brand-black">{event?.name || eventId}</h2>
          <p className="text-sm text-brand-muted" data-testid="go-live-status">
            {live ? "This event is live." : ended ? "This show has ended." : `Status: ${status.replaceAll("_", " ")}.`}
            {" "}
            {hasCredentials ? "Credentials are ready below." : ended ? "Its stream key was released — get a new one when you are ready to go live again." : "One click starts it and hands you the stream credentials."}
          </p>
        </div>
        {live ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-900">Live</span> : null}
      </div>

      <DeniedNote viewer={viewer} action="go_live" className="mt-3" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {live ? null : (
          <GatedForm viewer={viewer} action="go_live" formAction={goLiveAction}>
            <input type="hidden" name="eventId" value={eventId} />
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <button className="rounded-full bg-brand-black px-5 py-2 text-sm font-black text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-40" data-testid="go-live-button">
              {ended ? "Go live again" : "Go live"}
            </button>
          </GatedForm>
        )}
        {live || hasCredentials ? <SafeSection label="End of show" compact render={() => EndShowControl({ eventId, compact: true, viewer })} /> : null}
      </div>

      <StreamCredentials eventId={eventId} rtmpUrl={state?.livekitIngressUrl} streamKey={state?.livekitStreamKey} ended={ended} problem={state?.lastProvisionError} canAct={viewerCan(viewer, "go_live")} returnTo={returnTo} />

      {compact ? null : (
        <div className="mt-4 rounded-2xl bg-brand-ash p-4 text-sm">
          <p className="font-black">If the feed dies</p>
          <p className="mt-1 text-brand-muted">
            Fallback 1 is Cloudflare Stream — {fallback?.ready ? "ready now: set it up as a second Custom RTMP destination in StreamYard before the show, then move the room down from the crew deck." : fallback?.reason}
          </p>
        </div>
      )}
    </section>
  );
}
