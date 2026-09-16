export function SpeedNetworkingReportPanel() {
  return (
    <section className="rounded-3xl bg-white p-5">
      <h3 className="text-lg font-semibold">Match controls</h3>
      <div className="mt-4 grid gap-2">
        <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">End match</button>
        <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">Skip</button>
        <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Report</button>
      </div>
    </section>
  );
}
