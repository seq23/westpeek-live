export function StagePreStreamCard({ status = "Stage is getting ready. Live stream will begin shortly." }: { status?: string }) {
  return (
    <div className="wpl-as-authored flex aspect-video items-center justify-center rounded-3xl border border-white/10 bg-slate-900 p-8 text-center text-white">
      <div className="max-w-lg">
        <div className="mx-auto h-3 w-3 animate-ping rounded-full bg-brand-orange" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Pre-stream</p>
        <h2 className="mt-3 text-3xl font-black">Stage is getting ready.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{status}</p>
      </div>
    </div>
  );
}
