import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { HOW_IT_WORKS_DEFAULTS } from "@/services/content/howItWorksDefaults";
import { HOW_IT_WORKS_AUDIENCES } from "@/types/howItWorks";

export const metadata = {
  title: "How production works | West Peek Live",
  description:
    "What actually happens between requesting an event and the replay going out: scoping, run of show, speaker rehearsal, live technical direction, planned failover, and the assets afterwards.",
};

/**
 * The stages below describe how West Peek runs a production. The "more than 400
 * virtual and hybrid experiences since 2020" credential is West Peek
 * Productions' own published figure. No client, credit or testimonial appears
 * here, because none has been cleared for publication.
 */

const stages = [
  {
    step: "01",
    title: "Scope",
    body: "Seven inputs place a job in a price band and identify the rehearsal and failover work it needs: event type, target date, expected audience size, speaker count, single-run or series, the platform you already licence, and the moments in the show that must not fail.",
  },
  {
    step: "02",
    title: "Run of show",
    body: "A minute-by-minute document naming who is on screen, what is playing, who hands to whom, how Q&A is handled, and what happens if any of it fails. Most of what goes wrong publicly is something nobody was assigned.",
  },
  {
    step: "03",
    title: "Speaker rehearsal",
    body: "Every presenter, on the real platform, with the real deck and the real demo, from the location they will actually present from. This is the step organisations skip and the one that prevents the largest share of visible live failures.",
  },
  {
    step: "04",
    title: "Failover plan",
    body: "A named answer and a named person for a dropped presenter, a dead screen share, a demo that will not load, and a stream that stops. Dry-run at least once. If the plan is to improvise, that is not a plan, that is the incident.",
  },
  {
    step: "05",
    title: "Live technical direction",
    body: "Someone whose entire job during the show is the show — switching, cueing, audio, and watching for the thing that is about to go wrong — so the host can host and the speakers can speak.",
  },
  {
    step: "06",
    title: "Assets afterwards",
    body: "The recording is raw material, not the deliverable. Cut into clips, with the unanswered questions written up, it keeps working long after a two-hour file would have been filed and forgotten.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
          <WestPeekProductionsLogo size="md" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">How it works</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">What happens between the request and the replay.</h1>
          <p className="mt-4 text-sm leading-6 text-brand-muted">
            West Peek has produced more than 400 virtual and hybrid experiences since 2020. This is the sequence those productions run through, in the order the decisions have to be made.
          </p>

          <div className="mt-7 rounded-2xl border-l-4 border-brand-orange bg-brand-ash p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted">If you act on one thing</p>
            <p className="mt-3 text-sm font-bold leading-6">
              Get every speaker into a real rehearsal, on the real platform, with the real deck.
            </p>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              Speaker availability — not production capacity — is what makes lead time the binding constraint. Two to three weeks is workable for a straightforward single-speaker session. Multi-speaker panels, live demos and hybrid rooms need longer.
            </p>
          </div>

          <ol className="mt-10 grid gap-4">
            {stages.map((stage) => (
              <li key={stage.step} className="rounded-2xl border border-brand-line p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{stage.step}</p>
                <h2 className="mt-2 text-xl font-black tracking-tight">{stage.title}</h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">{stage.body}</p>
              </li>
            ))}
          </ol>

          <h2 className="mt-10 text-2xl font-black tracking-tight">What we run it on</h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Wherever it is sensible, the platform you already hold a licence for. Switching platforms close to a show adds a category of risk that has nothing to do with your content, and the time it costs comes out of rehearsal.
          </p>

          <h2 className="mt-10 text-2xl font-black tracking-tight">Where an in-room audience changes things</h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            It is the single biggest change to scope, budget and risk. Room audio, room vision, and the work of making the remote audience feel equally present rather than like they are watching someone else&apos;s meeting. It is also what moves a job into the higher <Link className="font-bold underline underline-offset-4 hover:text-brand-orange" href="/pricing">price category</Link>.
          </p>

          <div className="mt-10 rounded-2xl border border-brand-line bg-brand-ash p-6">
            <h2 className="text-xl font-black tracking-tight">Tell us what you are running</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Event type, target date, audience size, speaker count, and the moments that must not fail. That is enough for us to come back with a band and a plan.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/request-event" className="rounded-full bg-brand-black px-5 py-3 text-center text-sm font-bold text-white hover:bg-brand-charcoal">Plan an Event</Link>
              <Link href="/pricing" className="rounded-full border border-brand-black px-5 py-3 text-center text-sm font-bold text-brand-black hover:border-brand-orange hover:text-brand-orange">What it costs</Link>
            </div>
          </div>

          {/*
            The instruction pages. Once an event is paid for, everybody involved is emailed a link
            to one of these, so they live on the public site rather than behind the production
            gate: a link that only works for the person it was mailed to gets screenshotted and
            forwarded as a picture, and then it can never be corrected.
          */}
          <div className="mt-10 border-t border-brand-line pt-6" data-testid="how-it-works-index">
            <h2 className="text-xl font-black tracking-tight">Instructions, by who you are</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              When an event is confirmed we send everyone involved the page for their part in it. They are kept current, so read them here rather than from a saved copy.
            </p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {HOW_IT_WORKS_AUDIENCES.map((audience) => (
                <li key={audience}>
                  <Link href={`/how-it-works/${audience}`} className="font-bold underline underline-offset-4 hover:text-brand-orange">{HOW_IT_WORKS_DEFAULTS[audience].title}</Link>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/" className="mt-8 inline-flex text-sm font-bold text-brand-muted underline-offset-4 hover:text-brand-orange hover:underline">← Back to West Peek Live</Link>
        </section>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}
