import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { LaunchpadCard } from "@/components/production/LaunchpadCard";
import { ConsoleSection, ConsoleToc } from "@/components/owner/ConsoleSection";
import { SafeSection } from "@/components/system/SafeSection";
import { LocalTime } from "@/components/shared/LocalTime";
import { displayCode } from "@/lib/access/accessCodes";
import { listEventRecords } from "@/services/events/eventRepository";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The operator launchpad, reorganised (16 Sep 2026). It used to be nine sections of cards, most of
 * them pointing at the same demo event and nine of them at the same diagnostics page. Now: the
 * operator's REAL events first, then the three things they do (run a show, set one up, look after
 * people and data), diagnostics as two cards, and the demo kept but folded away.
 */
const SECTIONS = [
  { id: "your-events", label: "Your events" },
  { id: "run-a-show", label: "Run a show" },
  { id: "set-up", label: "Set up an event" },
  { id: "people-data", label: "People & data" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "demo", label: "Demo & training" },
] as const;

const LIVE = ["live"];
const UPCOMING = ["published", "registration_open", "pre_event"];

function EventLine({ event }: { event: RuntimeEventRecord }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line p-3" data-testid={`launchpad-event-${event.id}`} data-status={event.status}>
      <div>
        <p className="font-black text-brand-black">{event.name} <span className="ml-2 rounded-full bg-brand-ash px-2 py-0.5 text-[11px] font-black uppercase text-brand-muted">{event.status.replaceAll("_", " ")}</span></p>
        <p className="text-xs text-brand-muted">{displayCode(event.joinCode)} · {event.clientName} · <LocalTime iso={event.startAt} mode="datetime" /></p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-black">
        <Link href={`/app/events/${event.id}`} className="rounded-full border border-brand-black px-3 py-1 hover:border-brand-orange hover:text-brand-orange">Open</Link>
        <Link href={`/crew/events/${event.id}`} className="rounded-full border border-brand-black px-3 py-1 hover:border-brand-orange hover:text-brand-orange">Crew console</Link>
        <Link href={`/venue/${event.id}/lobby`} className="rounded-full border border-brand-black px-3 py-1 hover:border-brand-orange hover:text-brand-orange">Venue</Link>
      </div>
    </li>
  );
}

async function LaunchpadBody() {
  const events = await listEventRecords({ includeSeed: false }).catch(() => [] as RuntimeEventRecord[]);
  const live = events.filter((event) => LIVE.includes(event.status));
  const upcoming = events.filter((event) => UPCOMING.includes(event.status));
  const drafts = events.filter((event) => event.status === "draft");
  const runnable = [...live, ...upcoming, ...drafts];
  const current = live[0] || upcoming[0] || drafts[0];
  const toc = SECTIONS.map((section) => ({ ...section, count: section.id === "your-events" ? events.length : section.id === "run-a-show" ? runnable.length : undefined }));
  return (
    <div className="space-y-4">
      <ConsoleToc items={toc} />

      <ConsoleSection storagePrefix="wpl-launchpad" id="your-events" title="Your events" count={events.length} blurb="Everything on the books, newest first. Open one, drop into its crew console, or look at the venue a guest sees." defaultOpen>
        {events.length ? (
          <ul className="space-y-2">{[...live, ...upcoming, ...drafts, ...events.filter((event) => ![...live, ...upcoming, ...drafts].includes(event))].map((event) => <EventLine key={event.id} event={event} />)}</ul>
        ) : (
          <p className="text-sm text-brand-muted" data-testid="launchpad-no-events">No events yet. <Link className="font-black underline" href="/app/events/new">Create one</Link> — it takes a name and a time.</p>
        )}
      </ConsoleSection>

      <ConsoleSection storagePrefix="wpl-launchpad" id="run-a-show" title="Run a show" count={runnable.length} blurb="Show day: the crew console, the run of show, the stage, and the testing console for the event you are running." defaultOpen={Boolean(live.length)}>
        {current ? (
          <div className="space-y-3">
            <p className="text-sm text-brand-muted">Showing <strong>{current.name}</strong>{live.length ? " — live now" : ""}. Every other event is one click away above.</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <LaunchpadCard title="Crew console" href={`/crew/events/${current.id}`}>Go live, stage requests, chat moderation, speakers, end the show.</LaunchpadCard>
              <LaunchpadCard title="Run of show" href={`/app/events/${current.id}/run-of-show`}>The show caller&rsquo;s spine and the live cues.</LaunchpadCard>
              <LaunchpadCard title="Main stage" href={`/app/events/${current.id}/video/main-stage`}>The stage room as production sees it.</LaunchpadCard>
              <LaunchpadCard title="Video health" href={`/app/events/${current.id}/video-health`}>Which rung of the fallback ladder is ready right now.</LaunchpadCard>
              <LaunchpadCard title="Testing console" href={`/admin/testing/${current.id}`}>Route, access, runtime, email, and provider checks for this event.</LaunchpadCard>
              <LaunchpadCard title="Guest venue" href={`/venue/${current.id}/lobby`}>What an attendee sees when they arrive.</LaunchpadCard>
            </div>
          </div>
        ) : <p className="text-sm text-brand-muted">Nothing to run yet — create an event and these become its controls.</p>}
      </ConsoleSection>

      <ConsoleSection storagePrefix="wpl-launchpad" id="set-up" title="Set up an event" blurb="Before the doors open: make the event, hand out the codes, build the venue, write what goes out.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LaunchpadCard title="New event" href="/app/events/new">A name and a time is enough; everything else can follow.</LaunchpadCard>
          {current ? <LaunchpadCard title="Access codes" href={`/app/events/${current.id}/access`}>Join code and the role codes for {current.name}, with the links.</LaunchpadCard> : null}
          {current ? <LaunchpadCard title="Venue setup" href={`/app/events/${current.id}/venue`}>Lobby, stage, expo, networking, replay, help.</LaunchpadCard> : null}
          {current ? <LaunchpadCard title="Communications" href={`/app/events/${current.id}/communications`}>What goes out to this event&rsquo;s audience.</LaunchpadCard> : null}
          {current ? <LaunchpadCard title="Crew briefing" href={`/app/events/${current.id}/crew`}>The call sheet and instructions the crew read.</LaunchpadCard> : null}
          {current ? <LaunchpadCard title="Publish" href={`/app/events/${current.id}/publish`}>Readiness, then the public page goes live.</LaunchpadCard> : null}
        </div>
      </ConsoleSection>

      <ConsoleSection storagePrefix="wpl-launchpad" id="people-data" title="People & data" blurb="Everyone who has registered anywhere, the clients, and what an event produced.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LaunchpadCard title="People across events" href="/app/people">One row per person, by email, with the CSV export.</LaunchpadCard>
          <LaunchpadCard title="Clients" href="/app/clients">The companies the events belong to.</LaunchpadCard>
          <LaunchpadCard title="All events" href="/app/events">The full portfolio, including archived.</LaunchpadCard>
          {current ? <LaunchpadCard title="Analytics" href={`/app/events/${current.id}/analytics`}>Who came to {current.name}, and what they did.</LaunchpadCard> : null}
        </div>
      </ConsoleSection>

      <ConsoleSection storagePrefix="wpl-launchpad" id="diagnostics" title="Diagnostics" count={2} blurb="The testing console for everything scoped to an event, the live health of the deployment, and the manual.">
        <div className="grid gap-4 md:grid-cols-3">
          <LaunchpadCard title="Testing console" href="/admin/testing">Routes, access gates, runtime tables, email, video providers — pick the event inside.</LaunchpadCard>
          <LaunchpadCard title="The manual" href="/manual">Every door, every role, every step — the owner/operator/crew manual, inside the app.</LaunchpadCard>
          <LaunchpadCard title="Runtime health" href="/api/runtime/health">The deployed truth: store, schema, and the reads every crew page makes.</LaunchpadCard>
        </div>
      </ConsoleSection>

      <ConsoleSection storagePrefix="wpl-launchpad" id="demo" title="Demo & training" blurb="The demo event and the packet, for practice. Nothing here is a real client.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LaunchpadCard title="Demo venue" href="/venue/demo/lobby" badge="demo">Walk the attendee&rsquo;s path end to end.</LaunchpadCard>
          <LaunchpadCard title="Demo crew console" href="/crew/events/event-summit" badge="demo">Practise the show-day controls on nobody.</LaunchpadCard>
          <LaunchpadCard title="Operator packet" href="/operator-packet" badge="demo">How the doors, the roles and the codes fit together.</LaunchpadCard>
          <LaunchpadCard title="Test a crew login" href="/production-access/crew" badge="demo">See the gate exactly as hired crew see it.</LaunchpadCard>
          <LaunchpadCard title="Test a guest login" href="/production-access/special-guest" badge="demo">Speaker, sponsor, VIP, client — the same gate they get.</LaunchpadCard>
        </div>
      </ConsoleSection>
    </div>
  );
}

export function OperatorLaunchpad() {
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-6" data-testid="operator-launchpad">
          <section className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <WestPeekProductionsLogo size="md" />
                <p className="mt-5 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Operator launchpad</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Everything internal starts here.</h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted">Your events first, then the three things you do with them. Every section folds and remembers; the demo is kept for practice, out of the way.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/app/events/new" className="rounded-full bg-brand-black px-5 py-3 text-center text-sm font-black text-white hover:bg-brand-orange">New event</Link>
                <Link href="/production-access/logout" className="rounded-full border border-brand-black px-5 py-3 text-center text-sm font-bold hover:border-brand-orange hover:text-brand-orange">Log out access</Link>
              </div>
            </div>
          </section>
          <SafeSection label="Launchpad" render={() => LaunchpadBody()} />
        </div>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}
