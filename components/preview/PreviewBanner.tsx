import type { PreviewView } from "@/lib/auth/previewView";

/**
 * "Preview — you are seeing this as a VIP would. Nothing you do here is saved." Persistent, at the
 * top of every previewed venue page, with one click out. The person being previewed never sees it,
 * because nobody is being previewed: a persona is synthetic, and a mirror renders a real
 * attendee's state on the PRODUCER's screen, not theirs.
 */
export function PreviewBanner({ preview, leaveHref }: { preview: PreviewView; leaveHref: string }) {
  const mirror = preview.kind === "mirror";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-brand-orange bg-brand-orangeSoft p-4 text-slate-950 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="preview-banner" data-preview-kind={preview.kind} data-preview-id={preview.id} data-viewer={preview.viewer.kind}>
      <div>
        <p className="text-sm font-black">
          Preview — you are seeing this as {mirror ? <>{preview.label} sees it</> : <>{preview.label} would</>}. Nothing you do here is saved.
        </p>
        <p className="mt-1 text-xs text-slate-700">
          {mirror
            ? <>Their real state: {preview.state.vip ? "VIP" : "not a VIP"}, chat {preview.state.silenced ? "silenced" : "open"}, {preview.state.capability?.canJoinLiveStream ? "permitted to watch" : "no watch permit set"}. This is their state, not their screen.</>
            : <>The event&rsquo;s real configuration and content, rendered for {preview.label}. You are {preview.viewer.label}; nobody else can see this view, and no attendee count, roster, directory or export includes it.</>}
        </p>
      </div>
      <a href={leaveHref} className="shrink-0 rounded-full border border-slate-950 px-4 py-2 text-xs font-black hover:bg-white" data-testid="leave-preview">Leave preview</a>
    </div>
  );
}
