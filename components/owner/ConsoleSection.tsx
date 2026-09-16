"use client";
import { useEffect, useState, type ReactNode } from "react";

/**
 * A collapsible section of the Owner Console: a chevron, a heading with a count, a one-line
 * "what you do here", and the open/closed state remembered per section in localStorage.
 * Collapsed by default except where the console says otherwise ("Live now").
 */
export function ConsoleSection({ id, title, count, blurb, defaultOpen = false, storagePrefix = "wpl-owner-console", children }: { id: string; title: string; count?: number | string; blurb: string; defaultOpen?: boolean; storagePrefix?: string; children: ReactNode }) {
  const key = `${storagePrefix}-${id}`;
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { const stored = window.localStorage.getItem(key); if (stored === "open") setOpen(true); else if (stored === "closed") setOpen(false); } catch { /* fine */ }
    setHydrated(true);
  }, [key]);
  function toggle(next: boolean) {
    setOpen(next);
    try { window.localStorage.setItem(key, next ? "open" : "closed"); } catch { /* fine */ }
  }
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-brand-line bg-white shadow-sm" data-testid={`console-section-${id}`} data-open={open ? "true" : "false"} data-hydrated={hydrated ? "true" : "false"}>
      <button type="button" onClick={() => toggle(!open)} aria-expanded={open} aria-controls={`${id}-body`} className="flex w-full items-center justify-between gap-3 p-5 text-left" data-testid={`console-section-${id}-toggle`}>
        <span>
          <span className="flex items-center gap-2 text-xl font-black text-brand-black"><span aria-hidden="true" className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>{title}{count !== undefined ? <span className="rounded-full bg-brand-ash px-2 py-0.5 text-xs font-black text-brand-muted" data-testid={`console-section-${id}-count`}>{count}</span> : null}</span>
          <span className="mt-1 block text-sm text-brand-muted">{blurb}</span>
        </span>
        <span className="shrink-0 text-xs font-black uppercase tracking-wide text-brand-muted">{open ? "Collapse" : "Expand"}</span>
      </button>
      <div id={`${id}-body`} hidden={!open} className="border-t border-brand-line p-5">{children}</div>
    </section>
  );
}

/** The sticky row of anchor chips at the top of the console. */
export function ConsoleToc({ items }: { items: Array<{ id: string; label: string; count?: number | string }> }) {
  return (
    <nav className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-full border border-brand-line bg-white/95 px-2 py-2 shadow-sm backdrop-blur" aria-label="Owner console sections" data-testid="console-toc">
      <ul className="flex gap-2 whitespace-nowrap">
        {items.map((item) => <li key={item.id}><a href={`#${item.id}`} className="inline-flex items-center gap-1 rounded-full border border-brand-line px-3 py-1.5 text-xs font-black text-brand-black hover:border-brand-orange hover:text-brand-orange" data-testid={`console-toc-${item.id}`}>{item.label}{item.count !== undefined ? <span className="rounded-full bg-brand-ash px-1.5 text-[10px] text-brand-muted">{item.count}</span> : null}</a></li>)}
      </ul>
    </nav>
  );
}
