"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * One collapsible section for the whole venue. The owner asked for chevrons by name (16 Sep 2026):
 * a chevron, the whole header row is the control, and the open/closed choice is remembered per
 * viewer so a section she closed stays closed on the next page. The chevron only animates when the
 * viewer has not asked for reduced motion. Server-rendered children pass straight through, so a
 * section that reads the store still renders on the server inside its SafeSection; the content is
 * always in the DOM and only hidden, so it is there without JavaScript and for find-in-page.
 *
 * Open by default is for the thing the attendee came for. Everything secondary starts collapsed.
 */
export function VenueSection({
  id,
  eyebrow,
  title,
  summary,
  badge,
  defaultOpen = false,
  storageKey,
  testId,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  summary?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  storageKey: string;
  testId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = `${useId()}-region`;
  const key = `wpl-section-${storageKey}`;

  // The remembered choice arrives after hydration so the first paint matches the server.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === "open" || saved === "closed") setOpen(saved === "open");
    } catch {
      /* private mode: the section just uses its default every time */
    }
  }, [key]);

  // A link to #tell-us-more (or any anchor inside a closed section) must open it, not fail silently.
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    const openIfTargeted = () => { if (window.location.hash === `#${id}`) setOpen(true); };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, [id]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(key, next ? "open" : "closed"); } catch { /* nothing durable depends on it */ }
  }

  return (
    <section id={id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white" data-testid={testId || `venue-section-${storageKey}`} data-venue-section={storageKey} data-open={open ? "true" : "false"}>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={regionId} className="flex w-full items-start justify-between gap-4 p-4 text-left sm:p-5">
        <span className="min-w-0">
          {eyebrow ? <span className="block text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{eyebrow}</span> : null}
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-slate-950">{title}</span>
            {badge}
          </span>
          {summary ? <span className="mt-1 block text-sm text-slate-600">{summary}</span> : null}
        </span>
        <span className="mt-1 shrink-0 rounded-full border border-slate-200 p-1.5 text-slate-600" aria-hidden="true">
          <svg viewBox="0 0 20 20" className={`h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7.5 10 12.5 15 7.5" /></svg>
        </span>
      </button>
      <div id={regionId} hidden={!open} className="border-t border-slate-100 p-4 sm:p-5">{children}</div>
    </section>
  );
}
