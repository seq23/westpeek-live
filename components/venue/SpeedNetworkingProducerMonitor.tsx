import type { SpeedNetworkingProducerSummary } from "@/types/speedNetworkingEngine";

export function SpeedNetworkingProducerMonitor({ summary }: { summary: SpeedNetworkingProducerSummary }) {
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Speed networking</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">Producer queue monitor</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-2xl font-semibold">{summary.waitingCount}</p>
          <p className="text-sm text-slate-600">Waiting</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-2xl font-semibold">{summary.activeMatchCount}</p>
          <p className="text-sm text-slate-600">Active matches</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-2xl font-semibold">{summary.reportCount}</p>
          <p className="text-sm text-slate-600">Reports</p>
        </div>
      </div>
    </section>
  );
}
