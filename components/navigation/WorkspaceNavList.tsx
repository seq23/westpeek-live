"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, NEW_EVENT_ITEM, WORKSPACE_NAV } from "@/lib/navigation/workspaceNav";

/**
 * The sidebar's links, with exactly one of them marked as where you are. The "New event" button
 * stays a button; the current item is a quiet slab with an orange left rule, so the two never read
 * as the same thing.
 */
export function WorkspaceNavList() {
  const pathname = usePathname() || "/app";
  const active = activeNavHref(pathname);
  const newEventActive = active === NEW_EVENT_ITEM.href;
  return (
    <nav className="mobile-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:px-5" aria-label="Production OS">
      <Link
        href={NEW_EVENT_ITEM.href}
        aria-current={newEventActive ? "page" : undefined}
        className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold text-white lg:mb-2 lg:block lg:rounded-xl ${newEventActive ? "bg-brand-orange ring-2 ring-white/70" : "bg-brand-orange/90 hover:bg-brand-orange"}`}
        data-testid="sidebar-new-event"
        data-active={newEventActive ? "true" : "false"}
      >
        New event
      </Link>
      {WORKSPACE_NAV.map((item) => {
        const current = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            data-testid={`sidebar-link-${item.href.replace(/\//g, "-").replace(/^-/, "")}`}
            data-active={current ? "true" : "false"}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-sm lg:block lg:rounded-xl ${current ? "border border-white/20 bg-white/15 font-black text-white lg:border-l-4 lg:border-l-brand-orange" : "border border-white/10 text-white/78 hover:border-brand-orange hover:bg-brand-orange hover:text-white lg:border-transparent"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
