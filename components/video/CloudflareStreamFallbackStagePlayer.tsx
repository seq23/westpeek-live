"use client";

interface CloudflareStreamFallbackStagePlayerProps {
  playbackUrl?: string;
}

function isEmbeddableUrl(value?: string) {
  return Boolean(value && /^https:\/\//.test(value));
}

export function CloudflareStreamFallbackStagePlayer({ playbackUrl }: CloudflareStreamFallbackStagePlayerProps) {
  if (!isEmbeddableUrl(playbackUrl)) {
    return (
      <div className="wpl-as-authored flex aspect-video items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white">
        <div>
          <p className="text-lg font-black">Backup stream is being prepared.</p>
          <p className="mt-2 text-sm text-slate-300">The production team is moving the show to the backup live stream. You can stay on this page.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="wpl-as-authored overflow-hidden rounded-3xl bg-black">
      <iframe
        title="West Peek Live backup stream"
        src={playbackUrl}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="aspect-video w-full border-0"
      />
    </div>
  );
}
