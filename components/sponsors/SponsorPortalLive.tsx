import { LocalTime } from "@/components/shared/LocalTime";
import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { saveSponsorBoothAction } from "@/lib/actions/guestActions";
import { findEventRecord } from "@/services/events/eventRepository";
import { getSponsorBooth } from "@/services/guests/guestStateService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { SpecialGuestProfile } from "@/types/specialGuest";
import { ViewAsBanner } from "@/components/guests/ViewAsBanner";
import type { ViewAsContext } from "@/lib/auth/viewAs";

export type SponsorSurface = "home" | "setup" | "booth" | "leads" | "ready-room" | "report";

const nav: Array<[string, SponsorSurface, string]> = [["Sponsor portal", "home", ""], ["Booth setup", "booth", "booth"], ["Leads", "leads", "leads"], ["Ready room", "ready-room", "ready-room"], ["Report", "report", "report"]];

/**
 * The sponsor's real, event-scoped portal: who they are (once), their booth for THIS event
 * (name, blurb, link — shown in the venue Expo once named), the leads attendees opted in to
 * share at that booth, and honest empty states for the rest. No demo data.
 */
export async function SponsorPortalLive({ eventId, surface, sponsor, saved, error, viewAs }: { eventId: string; surface: SponsorSurface; sponsor?: SpecialGuestProfile; saved?: boolean; error?: string; viewAs?: ViewAsContext }) {
  const readOnly = Boolean(viewAs);
  const [event, booth] = await Promise.all([findEventRecord(eventId).catch(() => undefined), sponsor ? getSponsorBooth(eventId, sponsor.guestId) : Promise.resolve(undefined)]);
  const leads = sponsor && surface === "leads" ? (await getRuntimeStore().readSnapshot().catch(() => undefined))?.sponsorLeadOptIns.filter((item) => item.eventId === eventId && item.sponsorBoothId === sponsor.guestId) || [] : [];
  const ended = event?.status === "ended" || event?.status === "replay_available" || event?.status === "archived";
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8" data-view-as={viewAs?.guest.guestId}>
      <section className="mx-auto max-w-6xl space-y-6">
        {viewAs ? <ViewAsBanner viewAs={viewAs} backHref={`/app/events/${eventId}/access`} /> : null}
        <div className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-8" data-testid="sponsor-portal-shell">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Sponsor portal</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Booth setup and lead report · {event?.name || eventId}</h1>
          <p className="mt-2 text-sm text-brand-muted">{sponsor ? `${sponsor.name}${sponsor.company ? ` · ${sponsor.company}` : ""}` : "You have not told us who you are yet."}{booth?.published ? ` · booth "${booth.boothName}" is in the Expo` : " · no booth in the Expo yet"}</p>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sponsor portal navigation">
            {nav.map(([label, key, suffix]) => <a key={key} href={suffix ? `/sponsor/events/${eventId}/${suffix}` : `/sponsor/events/${eventId}`} className={`rounded-full px-4 py-2 text-sm font-bold ${surface === key || (key === "booth" && surface === "setup") ? "bg-brand-black text-white" : "border border-brand-line bg-white hover:border-brand-orange hover:text-brand-orange"}`}>{label}</a>)}
          </nav>
        </div>

        {!sponsor ? <GuestIdentityForm eventId={eventId} role="sponsor" returnTo={`/sponsor/events/${eventId}${surface === "home" ? "" : `/${surface}`}`} error={error} /> : null}

        {sponsor && (surface === "home" || surface === "setup" || surface === "booth") ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="sponsor-booth-editor">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Booth setup</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Your booth for this event</h2>
            <p className="mt-2 text-sm text-slate-600">Name it and it appears in the venue Expo for every attendee. The link opens from your booth card. Logo upload is not wired for this event; the blurb and link are what attendees see.</p>
            {saved ? <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="sponsor-booth-saved">Saved. {booth?.published ? "Your booth is live in the Expo." : "Give it a name to show it in the Expo."}</p> : null}
            <form action={readOnly ? undefined : saveSponsorBoothAction} className="mt-4 grid gap-3">
              <fieldset disabled={readOnly} className="contents" title={readOnly ? "Disabled while viewing as this sponsor." : undefined}>
              <input type="hidden" name="eventId" value={eventId} />
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Booth name<input name="boothName" defaultValue={booth?.boothName || sponsor.company} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Acme Cloud" data-testid="booth-name" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Blurb<textarea name="blurb" defaultValue={booth?.blurb} className="min-h-24 rounded-xl border border-slate-300 px-3 py-2" placeholder="One paragraph attendees read on your booth." data-testid="booth-blurb" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Link (https://…)<input name="link" defaultValue={booth?.link} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="https://example.com/offer" data-testid="booth-link" /></label>
              <div><button className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-40" data-testid="save-booth">Save booth</button>{booth?.published ? <a href={`/venue/${eventId}/expo`} className="ml-3 text-sm font-bold underline">See it in the Expo</a> : null}</div>
              </fieldset>
            </form>
            <GuestIdentityForm eventId={eventId} role="sponsor" returnTo={`/sponsor/events/${eventId}/booth`} existing={sponsor} compact readOnly={readOnly} />
          </section>
        ) : null}

        {sponsor && surface === "leads" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="sponsor-leads">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Leads</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{leads.length} attendee{leads.length === 1 ? "" : "s"} opted in at your booth</h2>
            {leads.length ? <ul className="mt-3 space-y-2 text-sm">{leads.map((lead) => <li key={lead.id} className="rounded-2xl bg-slate-50 p-3">Attendee {lead.attendeeId} · shared {lead.allowedFields.join(", ") || "contact"} · {<LocalTime iso={lead.createdAt} mode="datetime" />}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No leads yet. They appear here when an attendee chooses to share their details at your booth{booth?.published ? "" : " — name your booth first so it is in the Expo"}.</p>}
          </section>
        ) : null}

        {sponsor && surface === "ready-room" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="sponsor-ready-room">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Ready room</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Your booth is your room.</h2>
            <p className="mt-2 text-sm text-slate-600">Attendees reach you through the booth card in the Expo and its link. If the producer schedules you a sponsor moment on the stage, they bring you up from the crew console like a speaker.</p>
          </section>
        ) : null}

        {sponsor && surface === "report" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="sponsor-report">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Lead report</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{ended ? "The event has ended; your report is being prepared." : "The event has not ended yet, so there is no report to show."}</h2>
            <p className="mt-2 text-sm text-slate-600">The report lists the opt-in leads from your booth and the booth&rsquo;s visits. Nothing is invented before then.</p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
