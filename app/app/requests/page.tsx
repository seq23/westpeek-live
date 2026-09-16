import Link from "next/link";
import { EventRequestPipelinePanel } from "@/components/requests/EventRequestPipelinePanel";
import { SafeSection } from "@/components/system/SafeSection";
import { HOW_IT_WORKS_AUDIENCES } from "@/types/howItWorks";

export const dynamic = "force-dynamic";

/**
 * Where a request becomes an event.
 *
 * Everything submitted at /request-event arrives here. West Peek prices it, the client confirms it
 * on their own link, and when the money is in this page is where somebody presses the button that
 * records the settlement and sends the instructions.
 */
export default async function EventRequestsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const query = searchParams ? await searchParams : undefined;
  return (
    <main className="space-y-6">
      <SafeSection label="Event requests" render={() => EventRequestPipelinePanel({ query })} />
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">The instruction pages</h2>
        <p className="mt-2 text-sm text-slate-600">
          Marking a request paid emails each audience a link to one of these. The email never carries the text, so correcting a page corrects it for everyone who already has the link. Open one and use Edit this page.
        </p>
        <p className="mt-3 flex flex-wrap gap-3 text-sm">
          {HOW_IT_WORKS_AUDIENCES.map((audience) => (
            <Link key={audience} href={`/how-it-works/${audience}`} className="rounded-full border border-slate-200 px-4 py-1.5 font-semibold text-slate-800 hover:border-slate-400" data-testid={`requests-how-it-works-${audience}`}>
              /how-it-works/{audience}
            </Link>
          ))}
        </p>
      </section>
    </main>
  );
}
