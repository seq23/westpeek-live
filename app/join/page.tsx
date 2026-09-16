import { redirect } from "next/navigation";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";
import { resolveEventJoinCode } from "@/services/events/eventStateResolver";

export const dynamic = "force-dynamic";

/**
 * The front door for someone holding an invitation. A link with a code in it is one tap, not a
 * form with the code already typed in, a Resolve Event button and then a Continue card — that was
 * two clicks for something we said was automatic (the owner, on her phone, 16 Sep 2026). A code
 * that resolves cleanly redirects straight to the show. The form stays for a person who arrives
 * with nothing, and the card is only for the cases that need a human decision.
 */
const TROUBLE: Record<string, { heading: string; line: string }> = {
  missing_code: { heading: "We need your event code", line: "It is in your invitation email, usually near the top and shaped like wpl-ab12cd." },
  invalid_code: { heading: "That code did not match an event", line: "Check it against your invitation. The wpl- part and the hyphen are optional, but every one of the six characters after it counts." },
  not_public: { heading: "The doors are not open yet", line: "This event has not started letting people in. Keep this link. It will bring you straight in once the host opens it." },
  archived: { heading: "This event has been put away", line: "It is over and the recordings are no longer posted. Your host can tell you whether it is coming back." },
};

export default async function JoinEventPage({ searchParams }: { searchParams?: Promise<{ code?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const typedCode = resolvedSearchParams?.code?.trim();
  const resolution = await resolveEventJoinCode(typedCode);
  // Straight in. redirect() throws, so it has to sit outside any try.
  if (typedCode && resolution.ok && resolution.destination) redirect(resolution.destination);
  const trouble = TROUBLE[resolution.reason || "missing_code"] || TROUBLE.invalid_code;
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekLiveWordmark size="md" />
        <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">Join your event</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">Put in the code from your invitation and we will take you straight to the show. Nothing to install, and you can watch before you sign up for anything.</p>
        <form className="mt-6 flex flex-col gap-3" action="/join" method="get">
          <div>
            <label htmlFor="join-event-code" className="text-sm font-black">Event code</label>
            <p className="mt-1 text-xs text-brand-muted">It looks like wpl-ab12cd. Capitals and spaces are fine.</p>
            <input id="join-event-code" name="code" required defaultValue={typedCode ?? ""} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm outline-none focus:border-brand-orange" />
          </div>
          <button className="min-h-12 rounded-full bg-brand-black px-6 text-sm font-black text-white" data-testid="join-submit">Join</button>
        </form>
        {typedCode ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" data-testid="join-trouble" data-join-reason={resolution.reason || "unknown"}>
            <h2 className="text-xl font-black">{trouble.heading}</h2>
            {resolution.eventName ? <p className="mt-1 text-sm font-bold text-slate-700">{resolution.eventName}</p> : null}
            <p className="mt-2 text-sm leading-6 text-slate-700">{trouble.line}</p>
            {resolution.destination ? <a href={resolution.destination} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-black px-5 text-sm font-black text-white">Go to the event</a> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
