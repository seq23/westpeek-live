export function StageSwitchingOverlay({ message = "Switching to backup stream, please hold..." }: { message?: string }) {
  return (
    <div className="wpl-as-authored absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-slate-950/90 p-8 text-center text-white backdrop-blur-sm">
      <div>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Backup stream</p>
        <h2 className="mt-3 text-2xl font-black">{message}</h2>
        <p className="mt-3 max-w-md text-sm text-slate-300">The production team is keeping the show moving while the primary path recovers.</p>
      </div>
    </div>
  );
}
