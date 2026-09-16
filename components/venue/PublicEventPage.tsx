import { LocalTimeWindow } from "@/components/shared/LocalTimeWindow";
/* eslint-disable @typescript-eslint/no-explicit-any -- boundary adapters normalize legacy/runtime payloads before typed domain use */
import { LegalFooter } from "@/components/legal/LegalFooter";
import { submitEventRegistration } from "@/lib/actions/registrationActions";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EventEndedState } from "@/components/venue/EventEndedState";
import { EventNotOpenState } from "@/components/venue/EventNotOpenState";
import { RegistrationClosedState } from "@/components/venue/RegistrationClosedState";
import { RegistrationRequiredState } from "@/components/venue/RegistrationRequiredState";
import { getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { mapEventStatusToPublicState } from "@/services/events/eventStateResolver";

export function PublicEventPage({ slug }: { slug: string }) {
  const config = getEventConfigPackage(slug);
  const publicState = mapEventStatusToPublicState(config.event.state as any);

  if (publicState === "draft" || publicState === "archived") {
    return <EventNotOpenState title={config.event.name} message="This event is not publicly open. Use your event code again later or contact the production team." />;
  }

  return (
    <>
      <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-slate-950 p-8 text-white">
          <p className="text-sm text-slate-300">{config.event.client}</p>
          <h1 className="mt-3 text-4xl font-semibold">{config.event.name}</h1>
          <p className="mt-3 max-w-3xl text-slate-300">A branded virtual venue with lobby, main stage, sessions, sponsors, replay, networking, and production support.</p>
          <p className="mt-4 text-slate-300">{config.event.timezone} · Status: {publicState}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {publicState === "ended" ? <a href={`/venue/${config.event.id}/replay`} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Open replay</a> : null}
            {publicState === "open" || publicState === "upcoming" ? <a href={`/events/${config.event.slug}/register`} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Register</a> : null}
            {publicState === "live" ? <a href={`/venue/${config.event.id}/lobby`} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Enter venue</a> : null}
            <a href={`/venue/${config.event.id}/lobby`} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white">Preview venue</a>
          </div>
        </section>

        {publicState === "ended" ? <EventEndedState replayHref={`/venue/${config.event.id}/replay`} /> : null}
        {publicState === "upcoming" ? <RegistrationRequiredState registerHref={`/events/${config.event.slug}/register`} /> : null}

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <SectionCard title="Agenda preview">
            <div className="space-y-3">
              {config.agenda.sessions.map((session, index) => (
                <div key={session.id || String(index)} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium">{session.title}</p>
                  <p className="text-sm text-slate-500">{session.room} · <LocalTimeWindow startsAt={session.startsAt} endsAt={session.endsAt} /></p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Speakers">
            <div className="space-y-3">
              {config.speakers.speakers.map((speaker) => (
                <div key={speaker.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium">{speaker.name}</p>
                  <p className="text-sm text-slate-500">Speaker access is issued privately by the production team.</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Sponsors">
          <div className="grid gap-3 md:grid-cols-2">
            {config.sponsors.sponsors.map((sponsor) => (
              <div key={sponsor.id} className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold">{sponsor.name}</p>
                <p className="mt-1 text-sm text-slate-600">Sponsor booth, CTA, and report access are configured.</p>
                <StatusBadge status="configured" />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}

export function EventRegistration({ slug }: { slug: string }) {
  const config = getEventConfigPackage(slug);
  const publicState = mapEventStatusToPublicState(config.event.state as any);

  if (publicState === "draft" || publicState === "archived") {
    return <EventNotOpenState title={config.event.name} message="Registration is not open for this event." />;
  }

  if (publicState === "ended") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl"><RegistrationClosedState /></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <form action={submitEventRegistration} className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6">
        <input type="hidden" name="eventId" value={config.event.id} />
        <input type="hidden" name="slug" value={config.event.slug} />
        <p className="text-sm text-slate-500">Registration</p>
        <h1 className="mt-2 text-3xl font-semibold">{config.event.name}</h1>
        <p className="mt-2 text-slate-600">Name, email, company, and you are in. You can tell us more about yourself later; it makes the People page and networking work better for you.</p>
        <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Attendee registration does not grant speaker, sponsor, client, crew, operator, admin, VIP, restricted-session, or camera/mic publishing access.</p>
        <div className="mt-6 space-y-4">
          <p className="text-xs text-slate-500">Three fields and you are in. Fields marked <span className="font-black text-brand-orange">*</span> are required; everything else you can add later from &ldquo;Tell us more about you&rdquo; inside the venue.</p>
          {[
            ["name", "Name", "text", true, "Ada Lovelace"],
            ["email", "Email", "email", true, "you@company.com"],
            ["company", "Company / affiliation", "text", true, "Analytical Engines"],
            ["title", "Title / role (optional)", "text", false, "Founder"],
          ].map(([field, label, type, required, placeholder]) => (
            <div key={String(field)}>
              <label htmlFor={String(field)} className="text-sm font-medium text-slate-700">{label}{required ? <span className="ml-1 font-black text-brand-orange" aria-hidden="true">*</span> : null}</label>
              <input id={String(field)} name={String(field)} required={Boolean(required)} aria-required={Boolean(required)} type={String(type)} placeholder={String(placeholder)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand-orange" />
            </div>
          ))}
          <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white">Submit registration</button>
        </div>
      </form>
    </main>
  );
}
