import { buildVirtualVenueModel } from "@/services/venue";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { LiveRunOfShowDashboard } from "@/components/run-of-show/LiveRunOfShowDashboard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function VenueRunOfShowRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  return (
    <VenuePageShell model={model}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Run of Show</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Attendee-safe live schedule</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Follow the live event sequence without exposing producer-only notes, backup plans, or internal technical cues. If anything changes, this page gives attendees the safest version of what is happening now and what comes next.
        </p>
      </section>
      <LiveRunOfShowDashboard eventId={model.eventId} viewer="attendee" />
    </VenuePageShell>
  );
}
