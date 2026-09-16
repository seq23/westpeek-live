"use client";

import { useEffect, useState } from "react";

/**
 * A timestamp in the VIEWER's clock. Server components format in the Worker's clock, which is
 * UTC — the owner read "2:29 PM" on a chat message posted at 10:29 AM ET (16 Sep 2026). This
 * renders the ISO instant on the client, where the browser knows the zone; until hydration it
 * shows a zone-labelled UTC time so the first paint is never silently wrong.
 */
export function LocalTime({ iso, mode = "time", className }: { iso: string; mode?: "time" | "datetime"; className?: string }) {
  const [text, setText] = useState(() => serverFallback(iso, mode));
  useEffect(() => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) { setText(iso); return; }
    setText(mode === "time"
      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
  }, [iso, mode]);
  return <time dateTime={iso} className={className} suppressHydrationWarning>{text}</time>;
}

function serverFallback(iso: string, mode: "time" | "datetime") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = mode === "time"
    ? { hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }
    : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" };
  return new Intl.DateTimeFormat("en", opts).format(d);
}
