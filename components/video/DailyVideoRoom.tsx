interface DailyVideoRoomProps {
  roomUrl?: string;
  title?: string;
  description?: string;
}

export function DailyVideoRoom({ roomUrl, title = "West Peek Live! room", description }: DailyVideoRoomProps) {
  if (!roomUrl) {
    return (
      <div className="rounded-3xl border border-amber-300/30 bg-amber-950/30 p-6">
        <p className="text-lg font-semibold text-amber-100">Room is being prepared.</p>
        <p className="mt-2 text-sm text-amber-50/80">The production team is preparing an in-platform alternate room.</p>
      </div>
    );
  }

  return (
    <div className="wpl-as-authored rounded-3xl border border-white/10 bg-black/40 p-4">
      <div className="mb-4 rounded-2xl bg-slate-950/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-orange">West Peek Live! room</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
      </div>
      <iframe
        title={title}
        src={roomUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture"
        className="h-[680px] w-full rounded-2xl border border-white/10 bg-slate-950"
      />
    </div>
  );
}
