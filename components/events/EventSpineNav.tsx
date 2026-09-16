"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export interface SpineNavEntry {
  href: string;
  label: string;
  title: string;
  ready?: boolean;
}

export interface SpineNavGroup {
  id: string;
  title: string;
  entries: SpineNavEntry[];
}

/**
 * The spine's links, with the page you are on marked and scrolled into view when the column mounts
 * — the list is longer than the column, so the current page was often below the fold.
 */
export function EventSpineNav({ groups }: { groups: SpineNavGroup[] }) {
  const pathname = (usePathname() || "").replace(/\/+$/, "");
  const current = useRef<HTMLAnchorElement | null>(null);
  const activeHref = groups
    .flatMap((group) => group.entries)
    .filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest" });
  }, [activeHref]);
  return (
    <nav aria-label="Event pages" className="space-y-4" data-testid="event-spine" data-active={activeHref}>
      {groups.map((group) => (
        <div key={group.id} data-testid={`spine-group-${group.id}`}>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-muted">{group.title}</p>
          <ul className="mt-1 space-y-0.5">
            {group.entries.map((entry) => {
              const active = entry.href === activeHref;
              return (
                <li key={entry.href}>
                  <Link
                    ref={active ? current : undefined}
                    href={entry.href}
                    title={entry.title}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center rounded-xl px-2 py-1.5 text-sm font-bold ${active ? "border-l-4 border-brand-orange bg-brand-ash text-brand-black" : "text-brand-black hover:bg-brand-ash hover:text-brand-orange"}`}
                    data-testid={`spine-link-${entry.href.split("/").slice(4).join("/") || "root"}`}
                    data-active={active ? "true" : "false"}
                    data-ready={entry.ready === undefined ? undefined : entry.ready ? "true" : "false"}
                  >
                    {entry.label}
                    {entry.ready === undefined ? null : <span aria-hidden="true" className={`ml-2 inline-block h-2 w-2 rounded-full ${entry.ready ? "bg-emerald-500" : "bg-amber-400"}`} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
