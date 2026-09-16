export function LiveKitVideoSurface({ label = "LiveKit video room" }: { label?: string }) {
  return (
    <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-950 text-white">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-orange">LiveKit video surface</p>
        <p className="mt-2 text-2xl font-semibold">{label}</p>
        <p className="mt-2 text-sm text-slate-400">Provider: LiveKit primary. Automatic fallback uses Cloudflare Stream before Daily, then Zoom, then Google Meet.</p>
      </div>
    </div>
  );
}
