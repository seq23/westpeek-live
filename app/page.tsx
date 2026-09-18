import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-center rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10 lg:p-14">
        {/* DECLARED EXCEPTION — the only rendered mark in the app that is not a link home.
            This file IS https://westpeek.live/ (docs/DEPLOYMENT_ENV_CHECKLIST.md: "westpeek.live is
            the West Peek Live! app and public product domain"), so the crest and the wordmark below
            it would link the home page to itself: a control that looks actionable and does nothing.
            Named in scripts/validate_logo_home_links.js rather than pattern-matched away. */}
        <WestPeekProductionsLogo size="lg" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">West Peek Live</p>
        <h1 className="mt-5"><WestPeekLiveWordmark size="lg" /></h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-brand-muted">
          West Peek&rsquo;s own live Rooms and the branded events it produces for clients, run from one place — then the same operating system for agencies and production teams: attendee venues, production command centers, guest portals, run-of-show control, video fallback, access gates, and post-event reporting.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/join" className="rounded-full bg-brand-black px-5 py-3 text-center text-sm font-bold text-white hover:bg-brand-charcoal">Join an Event</Link>
          <Link href="/production-access" className="rounded-full border border-brand-black px-5 py-3 text-center text-sm font-bold text-brand-black hover:border-brand-orange hover:text-brand-orange">Production Access</Link>
          <Link href="/request-event" className="rounded-full border border-brand-black px-5 py-3 text-center text-sm font-bold text-brand-black hover:border-brand-orange hover:text-brand-orange">Plan an Event</Link>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/how-it-works" className="inline-flex text-sm font-bold text-brand-muted underline-offset-4 hover:text-brand-orange hover:underline">How production works →</Link>
          <Link href="/pricing" className="inline-flex text-sm font-bold text-brand-muted underline-offset-4 hover:text-brand-orange hover:underline">What it costs →</Link>
          <Link href="/venue/demo/lobby" className="inline-flex text-sm font-bold text-brand-muted underline-offset-4 hover:text-brand-orange hover:underline">Preview demo venue →</Link>
        </div>
      </section>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}
