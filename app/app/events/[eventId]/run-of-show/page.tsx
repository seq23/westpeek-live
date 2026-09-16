import { RunOfShowPage } from "@/components/run-of-show/RunOfShowPage";
import { LiveRunOfShowDashboard } from "@/components/run-of-show/LiveRunOfShowDashboard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function RunOfShowRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <div className="space-y-6">
      <RunOfShowPage eventId={resolvedParams.eventId} />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Producer controls</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Transactional run-of-show controls</h2>
        <p className="mt-2 text-sm text-slate-600">Use this during local pre-deploy E2E to prove producer actions write runtime run-of-show events instead of only rendering buttons.</p>
      </section>
      <LiveRunOfShowDashboard eventId={resolvedParams.eventId} viewer="agency" showControls />
    </div>
  );
}
