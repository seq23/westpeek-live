import { buildVirtualVenueModel } from "@/services/venue";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { AttendeeRunOfShow } from "@/components/venue/AttendeeRunOfShow";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

/**
 * The running order on its own page, for anyone who lands here directly or wants it in its own tab.
 * Every other venue page carries the same panel in place, so nobody has to leave a live show to
 * read it. The old title was a producer's phrase for a producer's idea of the schedule, and it
 * only made a guest wonder what the unsafe version said (the owner, 16 Sep 2026).
 */
export default async function VenueRunOfShowRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  return (
    <VenuePageShell model={model} showRunOfShow={false}>
      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Running order</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">How today runs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">What is on now, what is coming, and what has finished, with times in your own time zone. If the running order changes during the show, this changes with it.</p>
      </section>
      <SafeSection label="Running order" render={() => AttendeeRunOfShow({ eventId: model.eventId })} />
    </VenuePageShell>
  );
}
