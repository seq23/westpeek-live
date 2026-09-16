"use client";

import { useEffect, useState } from "react";
import type { AttendeeRunOfShowView } from "@/services/run-of-show/attendeeRunOfShow";

/**
 * The glance. Two rows open, one row collapsed, directly under the nav on every venue page so it
 * is always in the same place; the full tab is the detail and the header is the way into it.
 * Clicking "Open Run of Show" used to navigate an attendee off a live broadcast — this replaces
 * that with something they can read without leaving the show (the owner, 16 Sep 2026).
 *
 * Every time is the viewer's own clock, and relative where that reads better ("ends in 12 min").
 * Nothing producer-facing can reach it: it only ever renders the attendee-safe projection.
 */
export function RunOfShowStrip({ view, eventId, networkingOpen }: { view: AttendeeRunOfShowView; eventId: string; networkingOpen: boolean }) {
  const key = `wpl-run-of-show-strip-${eventId}`;
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  // Times are computed from the browser's clock, so they are withheld until hydration rather than
  // painted once in the Worker's UTC and corrected a moment later.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    try { if (window.localStorage.getItem(key) === "closed") setOpen(false); } catch { /* private mode: it stays open */ }
  }, [key]);
  // Relative times go stale; a minute is fine for "ends in 12 min".
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 60_000); return () => window.clearInterval(t); }, []);
  void tick;

  if (!view.total) return null;
  function toggle() {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(key, next ? "open" : "closed"); } catch { /* nothing durable depends on it */ }
  }

  const tab = `/venue/${eventId}/run-of-show`;
  const nowRow = view.now
    ? { label: "Now", title: view.now.title, room: view.now.room, when: mounted ? endsLabel(view.now.endAt) : "", href: view.now.networking || networkingOpen ? `/venue/${eventId}/networking` : undefined }
    : view.finished
      ? { label: "Now", title: "That's a wrap. Thanks for coming.", room: "", when: "", href: undefined }
      : { label: "Now", title: "Not started yet", room: "", when: "", href: undefined };
  // A one-segment event renders no NEXT row at all rather than an empty one; the last segment says so.
  const nextRow = view.next
    ? { title: view.next.title, when: mounted ? startsLabel(view.next.startAt) : "" }
    : view.total > 1 && !view.finished
      ? { title: "Nothing after this", when: "" }
      : undefined;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm" data-testid="run-of-show-strip" data-open={open ? "true" : "false"}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? "Collapse the run of show" : "Expand the run of show"} className="shrink-0 rounded-full p-1 text-slate-600 hover:bg-slate-100" data-testid="run-of-show-strip-toggle">
          <svg viewBox="0 0 20 20" className={`h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5" /></svg>
        </button>
        <a href={tab} className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-orange hover:underline" data-testid="run-of-show-strip-tab">Run of show</a>
        {open ? (
          <span className="ml-auto shrink-0 text-xs font-black text-slate-500" data-testid="run-of-show-strip-position">{view.position} of {view.total}</span>
        ) : (
          <p className="ml-1 min-w-0 flex-1 truncate text-xs text-slate-600" data-testid="run-of-show-strip-summary">
            <span className="font-black text-slate-900">Now:</span> {nowRow.title}{nextRow ? <> <span className="font-black text-slate-900">· Next:</span> {nextRow.title}{nextRow.when ? ` at ${nextRow.when}` : ""}</> : null}
          </p>
        )}
      </div>
      {open ? (
        <div className="mt-1.5 space-y-1 pl-8">
          <Row tone="now" label="Now" title={nowRow.title} room={nowRow.room} when={nowRow.when} href={nowRow.href} hrefLabel="Join the queue" testId="run-of-show-strip-now" />
          {nextRow ? <Row tone="next" label="Next" title={nextRow.title} when={nextRow.when} testId="run-of-show-strip-next" /> : null}
        </div>
      ) : null}
    </section>
  );
}

function Row({ tone, label, title, room, when, href, hrefLabel, testId }: { tone: "now" | "next"; label: string; title: string; room?: string; when?: string; href?: string; hrefLabel?: string; testId: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm" data-testid={testId}>
      <span className={`w-11 shrink-0 text-[10px] font-black uppercase tracking-[0.16em] ${tone === "now" ? "text-brand-orange" : "text-slate-400"}`}>{label}</span>
      <span className="min-w-0 font-black text-slate-950">{room ? `${room} · ` : ""}{title}</span>
      {when ? <span className="text-xs text-slate-500">{when}</span> : null}
      {href ? <a href={href} className="text-xs font-black text-emerald-700 underline">{hrefLabel}</a> : null}
    </div>
  );
}

/** "ends in 12 min" while it is close, "ends 3:40 PM" otherwise — both in the viewer's own clock. */
function endsLabel(endAt: string) {
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return "";
  const minutes = Math.round((end.getTime() - Date.now()) / 60_000);
  if (minutes >= 0 && minutes <= 30) return minutes <= 1 ? "ending now" : `ends in ${minutes} min`;
  return `ends ${clock(end)}`;
}

function startsLabel(startAt: string) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return "";
  const minutes = Math.round((start.getTime() - Date.now()) / 60_000);
  if (minutes >= 0 && minutes <= 30) return minutes <= 1 ? "any moment" : `in ${minutes} min`;
  return clock(start);
}

function clock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
