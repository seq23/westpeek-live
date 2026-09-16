export function EventEndedState({ replayHref }: { replayHref: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Event ended</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">Replay and recap are available when enabled.</h2>
      <a href={replayHref} className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Open replay center</a>
    </section>
  );
}
