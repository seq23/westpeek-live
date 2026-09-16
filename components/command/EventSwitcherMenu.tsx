"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchEventPath } from "@/lib/navigation/eventCommandSurfaces";

/**
 * The event name, and a menu of the other events. Jumping lands on the SAME KIND of page for the
 * other event — crew deck to crew deck, stage to stage — because an owner comparing two shows does
 * not want a list. Where this page has no counterpart (a booth, a session detail) it lands on that
 * event's overview instead of building a URL to a row that belongs to the event being left.
 *
 * Client-side only because the pathname is what decides the target, and a layout has no pathname.
 */
export function EventSwitcherMenu({ eventId, eventName, events }: { eventId: string; eventName: string; events: Array<{ id: string; name: string; status: string }> }) {
  const pathname = usePathname() || "";
  const others = events.filter((event) => event.id !== eventId);
  return (
    <details className="relative" data-testid="command-bar-event-switcher">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-white hover:bg-white/20">
        <span className="max-w-[14rem] truncate" data-testid="command-bar-event-name">{eventName}</span>
        <span aria-hidden>▾</span>
        <span className="sr-only">Switch event</span>
      </summary>
      <div className="absolute left-0 z-40 mt-2 max-h-80 w-72 overflow-auto rounded-2xl border border-brand-line bg-white p-2 shadow-xl">
        {others.length ? others.map((event) => (
          <Link key={event.id} href={switchEventPath(pathname, eventId, event.id)} className="block rounded-xl px-3 py-2 text-sm font-bold text-brand-black hover:bg-brand-ash" data-testid={`command-bar-switch-${event.id}`}>
            {event.name}
            <span className="ml-2 text-[11px] font-black uppercase tracking-wide text-brand-muted">{event.status.replaceAll("_", " ")}</span>
          </Link>
        )) : <p className="px-3 py-2 text-xs text-brand-muted">This is your only event.</p>}
      </div>
    </details>
  );
}
