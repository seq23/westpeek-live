/**
 * "Sep 23, 11:00 AM" is what a producer read on the event command page on 16 Sep 2026 for a show
 * that starts at 6:00 AM Chicago — the server formatted the instant in its own UTC clock and never
 * said so. A time is shown in the event's own zone when the caller knows it; when no zone is known
 * the zone abbreviation is appended ("11:00 AM UTC") so a bare time is never secretly UTC.
 */
export function formatEventDate(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const zone = timeZone?.trim() || undefined;
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(zone ? { timeZone: zone } : { timeZoneName: "short" }),
    }).format(date);
  } catch {
    // An unknown IANA name: still say which clock the reader is looking at.
    try {
      return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
    } catch {
      return value;
    }
  }
}

export function titleize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * "2026-09-16T05:10:38.777Z – 2026-09-16T07:10:38.777Z" is what attendees read under "Live now" on
 * 16 Sep 2026. A time is shown as a time, in the viewer's own clock (the venue is watched from
 * anywhere), with the date only when the two ends fall on different days.
 */
export function formatSessionWindow(startsAt?: string, endsAt?: string): string {
  if (!startsAt) return "Time TBA";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const time = (d: Date) => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
  const day = (d: Date) => new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(d);
  if (!endsAt) return `${day(start)} · ${time(start)}`;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return `${day(start)} · ${time(start)}`;
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${day(start)} · ${time(start)} – ${time(end)}` : `${day(start)} ${time(start)} – ${day(end)} ${time(end)}`;
}
