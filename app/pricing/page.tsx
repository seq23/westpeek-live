import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";

export const metadata = {
  title: "What event production costs | West Peek Live",
  description:
    "West Peek publishes its production price bands: $2,500 to $7,500 for moderated webinars, and $10,000 to $50,000 and above for summits, conferences and hybrid productions. Here is what moves a job inside a band.",
};

/**
 * The published price bands and the scope drivers behind them are West Peek
 * Productions' own, already published on virtualagency-os.com and on
 * westpeekproductions.com. Nothing here is a new or invented figure, and no
 * page on this site quotes a point estimate: the bands are real, a single
 * number inside one is not until someone has read a run of show.
 */

const bands = [
  {
    category: "Moderated webinars",
    range: "$2,500 to $7,500",
    fits: "A single session with a host and a small number of speakers. One room, one track, remote audience.",
  },
  {
    category: "Executive summits, conferences and hybrid productions",
    range: "$10,000 to $50,000 and above",
    fits: "An in-room audience, concurrent tracks, a full agenda across a day or more, or a redundant backup stream.",
  },
];

const drivers = [
  ["Speaker count", "Every additional speaker adds a tech check, a rehearsal slot to schedule, and one more thing that can fail live."],
  ["Rehearsal depth", "Production labour with speaker scheduling attached. Also the cheapest insurance in the engagement, because most visible failures trace to something a dry run would have caught."],
  ["Single-run or a series", "A repeating show amortises the setup, the templates and the run of show. The second episode is not priced like the first."],
  ["Failover posture", "Whether a redundant path exists for the stream, the deck and the presenter, and how fast it has to take over."],
  ["In-room audience", "Room audio, room vision, and making the remote audience feel equally present. This is the line between a webinar and a hybrid production."],
  ["Concurrent tracks", "Two things at once is not one job twice; it is two productions plus the coordination between them."],
] as const;

export default function PricingPage() {
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
          <WestPeekProductionsLogoHomeLink size="md" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">What it costs</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">What does event production cost?</h1>
          <p className="mt-4 text-sm leading-6 text-brand-muted">
            Most production companies will not publish a number. These are ours, the two categories they belong to, and the six things that decide where inside a band a specific job lands.
          </p>

          <div className="mt-7 rounded-2xl border-l-4 border-brand-orange bg-brand-ash p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted">The short answer</p>
            <p className="mt-3 text-sm font-bold leading-6">
              Moderated webinars are produced in the <strong>$2,500 to $7,500</strong> range. Executive summits, online conferences and hybrid productions are a separate category at <strong>$10,000 to $50,000 and above</strong>.
            </p>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              These are directional bands, not quotes. Where a job lands inside one is decided by the drivers below, and a single number before anyone has read a run of show would be invented.
            </p>
          </div>

          <h2 className="mt-10 text-2xl font-black tracking-tight">The two published bands</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-brand-line">
                  <th className="py-3 pr-4 text-xs font-black uppercase tracking-[0.12em] text-brand-muted">Category</th>
                  <th className="py-3 pr-4 text-xs font-black uppercase tracking-[0.12em] text-brand-muted">Published range</th>
                  <th className="py-3 text-xs font-black uppercase tracking-[0.12em] text-brand-muted">What puts a job here</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band.category} className="border-b border-brand-line align-top last:border-b-0">
                    <td className="py-4 pr-4 font-black">{band.category}</td>
                    <td className="py-4 pr-4 font-black text-brand-orange">{band.range}</td>
                    <td className="py-4 leading-6 text-brand-muted">{band.fits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-2xl font-black tracking-tight">The six drivers that move a job inside a band</h2>
          <ul className="mt-4 grid gap-4">
            {drivers.map(([label, detail]) => (
              <li key={label} className="rounded-2xl border border-brand-line p-4">
                <p className="text-sm font-black">{label}</p>
                <p className="mt-1 text-sm leading-6 text-brand-muted">{detail}</p>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 text-2xl font-black tracking-tight">Why there is no single number here</h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Because it would be made up. What a buyer needs before a conversation is the band, the position inside it, and the factors that moved it — not a fabricated precision that gets revised the moment anyone looks at the detail.
          </p>

          <h2 className="mt-10 text-2xl font-black tracking-tight">What pushes a job into the higher category</h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Any one of four conditions is usually enough: an in-room audience, concurrent tracks, a full conference agenda, or a redundant backup stream.
          </p>

          <h2 className="mt-10 text-2xl font-black tracking-tight">What we need to place your job in a band</h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Seven answers: event type, target date, expected audience size, speaker count, whether the session is single-run or a series, the platform you already hold a licence for, and the moments in the show that must not fail.
          </p>

          <h2 className="mt-10 text-2xl font-black tracking-tight">What is not included</h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Platform licence fees where you do not already hold one, paid promotion, speaker fees, and travel for an in-room component are separate from production.
          </p>

          <div className="mt-10 rounded-2xl border border-brand-line bg-brand-ash p-6">
            <h2 className="text-xl font-black tracking-tight">Get your event placed in a band</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Send the seven inputs above and we will tell you which category it is in, roughly where inside the band it sits, and which of your answers moved it.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/request-event" className="rounded-full bg-brand-black px-5 py-3 text-center text-sm font-bold text-white hover:bg-brand-charcoal">Plan an Event</Link>
              <Link href="/how-it-works" className="rounded-full border border-brand-black px-5 py-3 text-center text-sm font-bold text-brand-black hover:border-brand-orange hover:text-brand-orange">How production works</Link>
            </div>
          </div>

          <Link href="/" className="mt-8 inline-flex text-sm font-bold text-brand-muted underline-offset-4 hover:text-brand-orange hover:underline">← Back to West Peek Live</Link>
        </section>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}
