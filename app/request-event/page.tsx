import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { requestEventProduction } from "@/lib/actions/requestEventActions";
import { BUDGET_RANGES } from "@/types/eventRequest";

const fields = [
  ["name", "Name", "Your name"],
  ["email", "Email", "you@example.com"],
  ["company", "Company", "Company or team"],
  ["eventType", "Event type", "Webinar, summit, workshop, demo day"],
  ["eventDate", "Target date", "Known date or timing window"],
  ["audienceSize", "Expected audience size", "50, 500, 5,000..."],
  ["livestreamNeeds", "Livestream needs", "Main stage, backstage, recording, replay"],
  ["networkingNeeds", "Networking / breakout needs", "Speed networking, breakouts, VIP rooms"],
  ["sponsorExpoNeeds", "Sponsor / expo needs", "Booths, lead capture, sponsor reporting"],
  ["speakerCount", "Speaker count", "Number of speakers/panelists"],
  ["supportLevel", "Support level", "Full production, day-of support, platform only"],
] as const;

export default async function RequestEventPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogo size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Plan an Event</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Request Event production support.</h1>
        <p className="mt-4 text-sm leading-6 text-brand-muted">This is the public planning front door. It does not create an admin account, unlock the producer workspace, or expose self-serve billing. We use it to scope your event before opening production operations.</p>
        {/*
          "received" is reachable only when requestEventProduction confirmed a
          durable destination — a stored intake row, or a notification the real
          provider reported as sent. It used to be unconditional, which meant a
          request that reached nothing still told the visitor it had arrived.
        */}
        {resolvedSearchParams?.status === "received" ? <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Request received. West Peek Live can follow up with a production plan.</p> : null}
        {resolvedSearchParams?.status === "missing" ? <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Name, a valid email and a budget range are required.</p> : null}
        {resolvedSearchParams?.status === "failed" ? (
          <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">
            <p>We could not save your request, so it has not reached us. Nothing was recorded.</p>
            <p className="mt-2 font-normal">Please email <a className="font-bold underline" href="mailto:scooter@westpeek.ventures?subject=Event%20production%20request">scooter@westpeek.ventures</a> with your event type, target date, expected audience size and speaker count, and we will pick it up from there. Sorry — this one is on us.</p>
          </div>
        ) : null}
        <form action={requestEventProduction} className="mt-8 grid gap-5">
          {fields.map(([name, label, placeholder]) => (
            <div key={name}>
              <label htmlFor={name} className="text-sm font-black">{label}{name === "name" || name === "email" ? <span className="text-brand-orange"> *</span> : null}</label>
              <input id={name} name={name} type={name === "email" ? "email" : "text"} required={name === "name" || name === "email"} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
            </div>
          ))}
          {/*
            Budget is a required BAND, not a number. A visitor asked to type a figure either guesses
            low or abandons the form, and West Peek cannot price a request it has no band for.
            "Not sure yet" is a real answer and is one of the options.
          */}
          <div>
            <label htmlFor="budgetRange" className="text-sm font-black">Budget<span className="text-brand-orange"> *</span></label>
            <select id="budgetRange" name="budgetRange" required defaultValue="" data-testid="request-event-budget" className="mt-2 min-h-12 w-full rounded-full border border-brand-line bg-white px-5 text-sm">
              <option value="" disabled>Choose a range</option>
              {BUDGET_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-brand-muted">A range is enough. We come back with a price and a scope before anything is owed.</p>
          </div>
          <div>
            <label htmlFor="notes" className="text-sm font-black">Notes</label>
            <textarea id="notes" name="notes" rows={5} placeholder="Anything else producers should know before scoping the event." className="mt-2 w-full rounded-3xl border border-brand-line px-5 py-4 text-sm" />
          </div>
          <button className="rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Submit event request</button>
        </form>
      </section>
    </main>
  );
}
