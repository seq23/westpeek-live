/**
 * The demo summit's clock.
 *
 * Nova Founder Summit is the event the owner opens to show somebody what West Peek Live does, so
 * the one thing it must never be is over. Its segments used to carry fixed 12 June 2026 instants,
 * which meant that from 13 June onwards every venue page of the demo greeted the viewer with
 * "That's a wrap. Thanks for coming." — the strip, the running order and the lobby all agreed that
 * the product had nothing to show. (Reproduced 17 Sep 2026: attendeeRunOfShowView("event-summit")
 * returned finished: true, no now, no next.)
 *
 * So the demo's day is anchored to the viewer's own day instead. The show is treated as having
 * started ARRIVE_AT_MINUTE minutes ago, which puts the viewer in the middle of the main-stage panel
 * with finished segments behind them and networking, breakouts and the close still ahead. Every
 * demo time in the seed is expressed as an offset from that anchor, so the whole day — sessions,
 * run of show, expo, replay — stays consistent with itself no matter when it is opened.
 *
 * The anchor is floored to the minute so that every read inside a single render agrees, and it is
 * recomputed on each read rather than frozen at module load, so a long-lived Worker isolate does
 * not slowly walk the demo off the end of its own schedule.
 *
 * This clock is for the seeded demo event ONLY. Runtime-created events carry the real instants a
 * producer typed, and nothing here may touch them.
 */

/** Whole length of the summit, in minutes. Keep in step with the last segment's end offset. */
export const DEMO_SHOW_LENGTH_MINUTES = 295;

/**
 * How far into the show the viewer arrives. 85 minutes lands mid-panel: five segments finished,
 * one on now, and the sponsor spotlight, break, speed networking, breakouts and close still to come
 * — so a first glance shows the product working in all three tenses at once.
 */
export const DEMO_ARRIVE_AT_MINUTE = 85;

/** Start of the demo show, as epoch milliseconds, floored to the minute. */
export function demoShowStartMs(at: number = Date.now()): number {
  return Math.floor(at / 60_000) * 60_000 - DEMO_ARRIVE_AT_MINUTE * 60_000;
}

/** An instant `offsetMinutes` into the demo show, as an ISO string. */
export function demoIso(offsetMinutes: number, at?: number): string {
  return new Date(demoShowStartMs(at) + offsetMinutes * 60_000).toISOString();
}

/** A calendar date (YYYY-MM-DD) `offsetDays` from the demo show's day, for due dates on the board. */
export function demoDate(offsetDays: number, at?: number): string {
  return new Date(demoShowStartMs(at) + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Cheap per-minute memo. The seed arrays are read on every render of every venue page, and a fresh
 * array of objects each time would churn for no reason; within one minute the answer cannot change.
 */
export function demoMinuteMemo<T>(build: () => T): () => T {
  let minute = -1;
  let value: T;
  return () => {
    const current = Math.floor(Date.now() / 60_000);
    if (current !== minute) {
      minute = current;
      value = build();
    }
    return value;
  };
}
