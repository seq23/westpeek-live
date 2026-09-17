import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";

/**
 * The four doors, in plain words: who each one is for, what it opens, and which password it takes.
 * Owner and Operator are West Peek's own people; Crew is hired for the day; guests come with a role
 * code from their invitation. Order: the two everyday doors for outsiders first.
 */

export default function ProductionAccessPage() {
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogo size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Production Access</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Which door is yours?</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-brand-muted">Attendees never come through here; they use the event code. These four doors are for the people who run the show or appear in it. Each card says who it is for and what it opens.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <a href="/production-access/crew" className="rounded-3xl border border-slate-200 p-6 hover:border-brand-orange" data-testid="crew-access-card">
            <h2 className="text-2xl font-black">Crew / Production Team</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">People hired for the day — moderator, technical director, show caller, support. One event, one role, no admin. Uses the event&rsquo;s crew code (or the crew password from the packet).</p>
          </a>
          <a href="/production-access/special-guest" className="rounded-3xl border border-slate-200 p-6 hover:border-brand-orange" data-testid="special-guest-access-card">
            <h2 className="text-2xl font-black">Speakers, sponsors, VIPs, clients</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Guests with a role code from the invitation: green room and cue cards for speakers, booth for sponsors, lounge for VIPs, read-only overview for clients.</p>
          </a>
          <a href="/production-access/operator" className="rounded-3xl border border-slate-200 p-6 hover:border-brand-orange" data-testid="operator-access-card">
            <h2 className="text-2xl font-black">Operator Launchpad</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">West Peek&rsquo;s own producers and staff running the show from the control room: diagnostics, testing, fallback decisions, every event. Separate operator password.</p>
          </a>
          <a href="/production-access/owner" className="rounded-3xl border border-slate-200 p-6 hover:border-brand-orange" data-testid="owner-access-card">
            <h2 className="text-2xl font-black">Owner Access</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Sequoia and Scooter. The master password opens everything: create Rooms, run them, see every guest&rsquo;s view.</p>
          </a>
        </div>
      </section>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}
