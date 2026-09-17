import { describe, expect, it } from "vitest";
import { attendeeRunOfShowView } from "@/services/run-of-show/attendeeRunOfShow";
import { buildVirtualVenueModel } from "@/services/venue";
import { getRunOfShowForEvent, getSessionsForEvent } from "@/lib/runtime/getRuntimeData";
import { getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { demoShowStartMs, DEMO_SHOW_LENGTH_MINUTES } from "@/lib/mock/demoSchedule";
import { demoSummitAttendees, demoSummitSpeakers, demoSummitSponsors } from "@/lib/mock/demoSummit";

/**
 * The demo event is the product's shop window, so its emptiness is a product defect and is pinned
 * here as one.
 *
 * Reproduced 17 Sep 2026, before this work: the run of show was three segments fixed to 12 June
 * 2026, so attendeeRunOfShowView("event-summit") returned { total: 3, finished: true } with no now
 * and no next — every page of the demo venue told the viewer the show was over. Restore either the
 * three-segment seed or the fixed dates and the first two tests here fail again.
 */
const EVENT = "event-summit";
const MINIMUM_SEGMENTS = 12;

describe("the Nova Summit demo is a full show, and it is always on", () => {
  it("carries a producer-shaped run of show rather than a placeholder", () => {
    const segments = getRunOfShowForEvent(EVENT);
    expect(segments.length).toBeGreaterThanOrEqual(MINIMUM_SEGMENTS);
    for (const segment of segments) {
      expect(segment.publicTitle.length).toBeGreaterThan(8);
      expect(segment.clientFacingDescription.length).toBeGreaterThan(20);
      expect(segment.producerNotes.length).toBeGreaterThan(20);
      expect(segment.technicalCues.length).toBeGreaterThan(10);
      expect(segment.backupPlan.length).toBeGreaterThan(10);
      expect(segment.durationMinutes).toBeGreaterThan(0);
      expect(new Date(segment.endAt).getTime()).toBeGreaterThan(new Date(segment.startAt).getTime());
    }
  });

  it("is never a finished event: something is on now and something is next", () => {
    const view = attendeeRunOfShowView(EVENT);
    expect(view.finished).toBe(false);
    expect(view.now).toBeDefined();
    expect(view.next).toBeDefined();
    expect(view.total).toBeGreaterThanOrEqual(MINIMUM_SEGMENTS);
    expect(view.position).toBeGreaterThan(1);
    expect(view.position).toBeLessThan(view.total);
  });

  it("has something on at every minute of the show, so the strip never goes blank", () => {
    const start = demoShowStartMs();
    const blank: number[] = [];
    let examined = 0;
    for (let minute = 0; minute < DEMO_SHOW_LENGTH_MINUTES; minute += 1) {
      examined += 1;
      const view = attendeeRunOfShowView(EVENT, start + minute * 60_000 + 30_000);
      if (!view.now) blank.push(minute);
    }
    expect(examined).toBe(DEMO_SHOW_LENGTH_MINUTES);
    expect(blank).toEqual([]);
  });

  it("exercises the features the product has, rather than describing them", () => {
    const titles = getRunOfShowForEvent(EVENT).map((segment) => `${segment.publicTitle} ${segment.room}`).join(" | ").toLowerCase();
    for (const feature of ["keynote", "panel", "q&a", "sponsor spotlight", "expo", "networking", "breakout", "fireside", "closing"]) {
      expect(titles).toContain(feature);
    }
    // The networking block must light up the queue link on the attendee row.
    expect(attendeeRunOfShowView(EVENT).segments.some((segment) => segment.networking)).toBe(true);
  });

  it("fills the venue: sessions, breakouts, booths, replays and a People page", () => {
    const model = buildVirtualVenueModel(EVENT);
    expect(model.sessions.length).toBeGreaterThanOrEqual(12);
    expect(model.liveNow.length).toBeGreaterThanOrEqual(1);
    expect(model.upNext.length).toBeGreaterThanOrEqual(1);
    expect(model.breakouts.length).toBeGreaterThanOrEqual(3);
    expect(model.booths.length).toBeGreaterThanOrEqual(3);
    expect(model.people.length).toBeGreaterThanOrEqual(12);
    // Only what has finished or is on can be replayed, and something has finished by now.
    expect(model.replays.length).toBeGreaterThanOrEqual(1);
    expect(model.replays.some((replay) => replay.status === "available")).toBe(true);
    expect(model.replays.every((replay) => replay.status !== "not_available")).toBe(true);
  });

  it("keeps the venue clock and the public landing page telling the same story", () => {
    const pkg = getEventConfigPackage("demo");
    expect(pkg.agenda.sessions.length).toBeGreaterThanOrEqual(12);
    expect(pkg.runOfShow.segments.length).toBeGreaterThanOrEqual(MINIMUM_SEGMENTS);
    const firstSession = pkg.agenda.sessions[0];
    expect(firstSession.endsAt).toBeTruthy();
    // Re-anchored onto the same day the venue is running, not the canonical June show day.
    const drift = Math.abs(new Date(firstSession.startsAt).getTime() - demoShowStartMs());
    expect(drift).toBeLessThan(60 * 60_000);
    expect(pkg.speakers.speakers.length).toBeGreaterThanOrEqual(6);
    expect(pkg.sponsors.sponsors.length).toBeGreaterThanOrEqual(3);
  });

  it("stays unmistakably a demo: invented people, unreachable addresses, nothing that can send", () => {
    const addressed = [...demoSummitSpeakers, ...demoSummitSponsors.map((s) => ({ email: s.primaryContactEmail })), ...demoSummitAttendees];
    expect(addressed.length).toBeGreaterThan(15);
    for (const row of addressed) {
      expect(row.email.endsWith("@example.com")).toBe(true);
    }
    // The demo must never borrow a real West Peek client or the owner's own name.
    const everything = JSON.stringify([demoSummitSpeakers, demoSummitSponsors, demoSummitAttendees, getRunOfShowForEvent(EVENT)]).toLowerCase();
    for (const forbidden of ["west peek capital", "sequoia taylor", "s.l. taylor", "seq.taylor"]) {
      expect(everything).not.toContain(forbidden);
    }
  });

  it("runs on the viewer's own day, so it cannot go stale again", () => {
    const sessions = getSessionsForEvent(EVENT);
    expect(sessions.length).toBeGreaterThanOrEqual(12);
    const sorted = [...sessions].sort((a, b) => a.startAt.localeCompare(b.startAt));
    // No gaps: each session starts no later than the previous one ends.
    let examined = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      examined += 1;
      expect(new Date(sorted[i].startAt).getTime()).toBeLessThanOrEqual(new Date(sorted[i - 1].endAt).getTime());
    }
    expect(examined).toBeGreaterThanOrEqual(11);
    // None of it is pinned to the retired 12 June 2026 show day.
    expect(sorted.some((session) => session.startAt.startsWith("2026-06-12"))).toBe(false);
  });
});
