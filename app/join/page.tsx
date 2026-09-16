import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { resolveEventJoinCode } from "@/services/events/eventStateResolver";

export const dynamic = "force-dynamic";

export default async function JoinEventPage({ searchParams }: { searchParams?: Promise<{ code?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const resolution = await resolveEventJoinCode(resolvedSearchParams?.code);
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogo size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Attendee access</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Join an Event</h1>
        <p className="mt-4 text-sm leading-6 text-brand-muted">Enter the event code from your invitation. The resolver handles upcoming, open, live, ended, replay, invalid, and archived states without exposing production routes.</p>
        <form className="mt-6 flex flex-col gap-3" action="/join" method="get">
          <div>
            <label htmlFor="join-event-code" className="text-sm font-black">Event code <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">Use the code from your invitation or production contact. Demo path: demo.</p>
            <input id="join-event-code" name="code" required defaultValue={resolvedSearchParams?.code ?? ""} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm outline-none focus:border-brand-orange" />
          </div>
          <button className="rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Resolve Event</button>
        </form>
        {resolvedSearchParams?.code ? (
          <div className={`mt-6 rounded-2xl border p-5 ${resolution.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-black uppercase tracking-[0.2em]">{resolution.ok ? "Event found" : "Access state"}</p>
            <h2 className="mt-2 text-2xl font-black">{resolution.eventName ?? `No event for “${resolvedSearchParams.code}”`}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{resolution.message}</p>
            {resolution.destination ? <a href={resolution.destination} className="mt-4 inline-flex rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white">Continue</a> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
