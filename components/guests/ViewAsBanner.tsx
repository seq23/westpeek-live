import type { ViewAsContext } from "@/lib/auth/viewAs";

const ROLE_WORD = { speaker: "speaker", sponsor: "sponsor", vip: "VIP", client: "client" } as const;

/**
 * "Viewing as Sam Speaker — you are the producer; they can't see this banner." Sits above a
 * guest's real page when an owner / operator / producer opened it with ?viewAs=. The guest's own
 * actions on the page are disabled in this mode; nothing here is visible to the guest.
 */
export function ViewAsBanner({ viewAs, backHref }: { viewAs: ViewAsContext; backHref: string }) {
  const { guest, viewer } = viewAs;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-brand-orange bg-brand-orangeSoft p-4 text-slate-950 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="view-as-banner" data-view-as={guest.guestId} data-viewer={viewer.kind}>
      <div>
        <p className="text-sm font-black">Viewing as {guest.name} — you are {viewer.label}; they can&rsquo;t see this banner.</p>
        <p className="mt-1 text-xs text-slate-700">This is the {ROLE_WORD[guest.role]}&rsquo;s real page and real state, read-mostly: their buttons are disabled for you. Every link here keeps you in their view.</p>
      </div>
      <a href={backHref} className="shrink-0 rounded-full border border-slate-950 px-4 py-2 text-xs font-black hover:bg-white" data-testid="view-as-back">Back to the crew deck</a>
    </div>
  );
}
