import Link from "next/link";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";

export async function Topbar() {
  const actor = await getWorkspaceActor();
  return (
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="lg:hidden"><WestPeekLiveWordmark size="sm" /></div>
          <p className="hidden text-xs font-black uppercase tracking-[0.28em] text-brand-orange lg:block">Production workspace</p>
          <p className="mt-1 text-sm text-brand-muted">Plan, produce, run, and report on West Peek Rooms and client events.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/events/new" className="rounded-full bg-brand-black px-4 py-2 text-sm font-bold text-white hover:bg-brand-orange" data-testid="topbar-new-event">New event</Link>
          <span className="inline-flex w-fit rounded-full border border-brand-line bg-brand-ash px-3 py-2 text-sm font-semibold text-brand-black" data-testid="workspace-actor">
            {actor?.label || "Not signed in"}
          </span>
        </div>
      </div>
    </header>
  );
}
