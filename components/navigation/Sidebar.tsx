import Link from "next/link";
import { WestPeekLiveMark, WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";

const nav = [
  ["Dashboard", "/app"],
  ["Clients", "/app/clients"],
  ["People", "/app/people"],
  ["Events", "/app/events"],
  ["Email", "/app/email"],
  ["Templates", "/app/templates"],
  ["Contractors", "/app/contractors"],
  ["Vendors", "/app/vendors"],
  ["Assets", "/app/assets"],
  ["Settings", "/app/settings"],
  ["Testing Console", "/admin/testing"],
];

export function Sidebar() {
  return (
    <aside className="border-b border-brand-line bg-brand-black text-white lg:sticky lg:top-0 lg:block lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r lg:border-white/10">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block lg:p-5">
        <div className="flex items-center gap-3 lg:block">
          <WestPeekLiveMark inverse />
          <div className="lg:mt-4">
            <WestPeekLiveWordmark size="sm" inverse />
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/45">Production OS</p>
          </div>
        </div>
        <a href="/app" className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/80 lg:hidden">
          Menu
        </a>
      </div>
      <nav className="mobile-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:px-5">
        <Link href="/app/events/new" className="whitespace-nowrap rounded-full bg-brand-orange px-3 py-2 text-sm font-bold text-white lg:mb-2 lg:block lg:rounded-xl" data-testid="sidebar-new-event">New event</Link>
        {nav.map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="whitespace-nowrap rounded-full border border-white/10 px-3 py-2 text-sm text-white/78 hover:border-brand-orange hover:bg-brand-orange hover:text-white lg:block lg:rounded-xl lg:border-transparent"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="hidden p-5 lg:block">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-sm text-white/70">
          <p className="font-bold text-white">Live production mode</p>
          <p className="mt-1">Events, clients, and settings are real rows in the runtime store. Reports live on each event&rsquo;s Reports tab.</p>
        </div>
      </div>
    </aside>
  );
}
