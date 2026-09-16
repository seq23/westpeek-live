"use client";

import { useEffect, useState } from "react";

/**
 * A start–end window in the VIEWER's clock. The owner read "Wed, Sep 16 · 2:18 PM UTC – 4:18 PM UTC"
 * on her own agenda card (16 Sep 2026): a server component formatted the instants in the Worker's
 * clock, which is UTC. Same contract as LocalTime — the ISO instants are formatted on the client,
 * where the browser knows the zone, and the pre-hydration paint is zone-labelled so it is never
 * silently wrong. The date is shown only when the two ends fall on different days.
 */
export function LocalTimeWindow({ startsAt, endsAt, className }: { startsAt?: string; endsAt?: string; className?: string }) {
  const [text, setText] = useState(() => windowText(startsAt, endsAt, "UTC"));
  useEffect(() => { setText(windowText(startsAt, endsAt)); }, [startsAt, endsAt]);
  return <span className={className} suppressHydrationWarning>{text}</span>;
}

function windowText(startsAt?: string, endsAt?: string, timeZone?: string) {
  if (!startsAt) return "Time to be announced";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  // With no zone passed the browser's own zone is used and no abbreviation is needed; the
  // pre-hydration paint passes "UTC" so the reader can see which clock it is looking at.
  const zone = timeZone ? { timeZone, timeZoneName: "short" as const } : {};
  const time = (d: Date) => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", ...zone }).format(d);
  const day = (d: Date) => new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", ...(timeZone ? { timeZone } : {}) }).format(d);
  if (!endsAt) return `${day(start)} · ${time(start)}`;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return `${day(start)} · ${time(start)}`;
  const sameDay = day(start) === day(end);
  return sameDay ? `${day(start)} · ${time(start)} – ${time(end)}` : `${day(start)} ${time(start)} – ${day(end)} ${time(end)}`;
}
