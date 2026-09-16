import { describe, expect, it } from "vitest";
import { zonedLocalToIso } from "@/services/events/eventRepository";
import { getRunOfShowForEvent } from "@/lib/runtime/getRuntimeData";

/**
 * Three things the first production e2e (15 Sep 2026) caught. Each is pinned so it cannot return.
 */
describe("a Later event's start time is read in the event's timezone", () => {
  it("3:00 AM Chicago is 08:00Z in September and 09:00Z in December", () => {
    expect(zonedLocalToIso("2026-09-23T03:00", "America/Chicago")).toBe("2026-09-23T08:00:00.000Z");
    expect(zonedLocalToIso("2026-12-23T03:00", "America/Chicago")).toBe("2026-12-23T09:00:00.000Z");
    expect(zonedLocalToIso("2026-09-23T03:00", "America/New_York")).toBe("2026-09-23T07:00:00.000Z");
    expect(zonedLocalToIso("2026-09-23T03:00", "UTC")).toBe("2026-09-23T03:00:00.000Z");
  });
  it("still accepts a full ISO instant", () => {
    expect(zonedLocalToIso("2026-09-23T03:00:00.000Z", "America/Chicago")).toBe("2026-09-23T03:00:00.000Z");
  });
});

describe("a real event's run of show never carries the demo summit's words", () => {
  it("the seed segment's producer notes do not appear on any runtime-created event", () => {
    // Nothing is hydrated in a unit test, so no runtime event exists; the guard is on the seed
    // itself: the demo's notes are the only place that sentence may live.
    const seedSegments = getRunOfShowForEvent("event-summit");
    expect(seedSegments.some((s) => /Drake/.test(s.producerNotes))).toBe(true);
  });
});

describe("watching the stage never publishes the attendee's microphone", () => {
  it("LiveKitRoom is mounted with audio={false}; mute and volume go to the renderer", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../components/video/LiveKitIngressStagePlayer.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/<LiveKitRoom[^>]*audio=\{false\}/);
    expect(src).not.toMatch(/<LiveKitRoom[^>]*audio=\{!muted\}/);
    expect(src).toMatch(/<RoomAudioRenderer muted=\{muted\} volume=\{volume\} \/>/);
  });
});

describe("the attendee agenda shows times, not ISO strings", () => {
  it("formats a same-day window as day · start – end", async () => {
    const { formatSessionWindow } = await import("@/lib/utils/format");
    const out = formatSessionWindow("2026-09-16T05:10:38.777Z", "2026-09-16T07:10:38.777Z");
    expect(out).not.toMatch(/T\d\d:\d\d:\d\d/);
    expect(out).toContain("\u2013");
    expect(formatSessionWindow(undefined)).toBe("Time TBA");
    expect(formatSessionWindow("garbage")).toBe("garbage");
  });
});

describe("a join code typed on a phone still finds the Room", () => {
  it("maps capitals, dashes, spaces, a dropped hyphen and a dropped prefix to the one code", async () => {
    const { joinCodeCandidates } = await import("@/services/events/eventRepository");
    for (const typed of ["WPL-VXCKX6", "wpl–vxckx6", "wpl vxckx6", "wplvxckx6", " wpl-vxckx6 ", "vxckx6", "Wpl- vxckx6"]) {
      expect(joinCodeCandidates(typed), typed).toContain("wpl-vxckx6");
    }
    // Slugs and ids still pass through untouched as the first candidate.
    expect(joinCodeCandidates("sequoia-s-first-room")[0]).toBe("sequoia-s-first-room");
  });
});

describe("a guest inside the venue can find registration", () => {
  it("every 'register' notice in the venue links to the event's registration form", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["VenueLobbyDashboard", "LiveRoomChat", "AttendeeStageJoinControls", "MyAgendaPanel"]) {
      const src = readFileSync(new URL(`../../components/venue/${file}.tsx`, import.meta.url), "utf8");
      expect(src, file).toMatch(/href=\{`\/events\/\$\{[a-zA-Z.]+\}\/register`\}/);
    }
  });
  it("a typed code resolves through the record's real join code", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../services/events/eventStateResolver.ts", import.meta.url), "utf8");
    expect(src).toMatch(/resolveHydratedEventJoinCode\(runtime\?\.joinCode \?\? code\)/);
  });
});

describe("event areas land on the canonical event id", () => {
  it("every event area has a layout that redirects a join code to the id", async () => {
    const { readFileSync } = await import("node:fs");
    for (const area of ["crew/events", "app/events", "venue", "speaker/events", "admin/testing"]) {
      const src = readFileSync(new URL(`../../app/${area}/[eventId]/layout.tsx`, import.meta.url), "utf8");
      expect(src, area).toMatch(/canonicalEventIdOrRedirect/);
    }
  });
  it("the crew deck carries the go-live console", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../components/moderation/CrewLiveModerationDeck.tsx", import.meta.url), "utf8");
    // Rendered through SafeSection (called inside its try) so a store failure never takes the deck down.
    expect(src).toMatch(/render=\{\(\) => StreamYardIngressPanel\(\{ eventId/);
  });
});

describe("the stage token fetch cannot cancel itself", () => {
  it("the fetched-for-grant marker is a ref, never a dependency of the effect that sets it", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../components/video/LiveKitIngressStagePlayer.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/const fetchedForGrant = useRef</);
    expect(src).not.toMatch(/setFetchedForGrant/);
    expect(src).not.toMatch(/\[eventId, roomId, displayName, grantWantsPublish, removed, fetchedForGrant\]/);
  });
});

describe("timestamps render in the viewer's clock, never the Worker's UTC", () => {
  it("no server component formats a Date with a zone-less toLocale*() call", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.tsx$/.test(name) || name === "LocalTime.tsx") continue;
        const src = readFileSync(p, "utf8");
        if (/^\s*["']use client["']/.test(src)) continue;
        if (/\.toLocale(Time|Date)?String\(\)/.test(src)) offenders.push(p);
      }
    };
    for (const root of ["components", "app"]) walk(new URL(`../../${root}`, import.meta.url).pathname);
    expect(offenders).toEqual([]);
  });
});

describe("the stage shows publishers only, and reset drops the participant", () => {
  it("the player asks LiveKit for no placeholders and filters to published tracks", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../components/video/LiveKitIngressStagePlayer.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/Track\.Source\.Camera, withPlaceholder: false/);
    expect(src).toMatch(/tracks\.filter\(\(t\) => Boolean\(t\.publication\)\)/);
    expect(src).toMatch(/isProductionFeedIdentity/);
  });
  it("reset and decline remove the participant from the stage room like revoke", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../lib/actions/attendeeLiveActions.ts", import.meta.url), "utf8");
    expect(src).toMatch(/decision === "revoke" \|\| decision === "reset" \|\| decision === "decline"/);
  });
  it("the ingress participant carries no name plate", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../services/video/livekitIngressService.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/participant_name: "StreamYard Production Feed"/);
  });
});

describe("speed networking tables are the runtime ones, and a failing card never takes a page down", () => {
  it("migration 0028 moves the legacy uuid tables aside before creating the runtime ones, and the supabase mirror is byte-identical", async () => {
    const { readFileSync } = await import("node:fs");
    const a = readFileSync(new URL("../../db/migrations/0028_speed_networking_runtime_tables.sql", import.meta.url), "utf8");
    const b = readFileSync(new URL("../../supabase/migrations/20260916160000_speed_networking_runtime_tables.sql", import.meta.url), "utf8");
    expect(a).toBe(b);
    expect(a).toMatch(/rename to speed_networking_matches_legacy_v1/);
    expect(a).toMatch(/rename to speed_networking_entries_legacy_v1/);
    expect(a.indexOf("rename to")).toBeLessThan(a.indexOf("create table if not exists public.speed_networking_entries"));
  });
  it("the crew networking card and the attendee queue panel catch store failures", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["components/moderation/NetworkingCrewCard.tsx", "components/venue/SpeedNetworkingQueuePanel.tsx"]) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
      expect(src, f).toMatch(/unavailable/);
      expect(src, f).toMatch(/try \{/);
    }
  });
});

describe("registration: required fields are marked and a website needs no scheme", () => {
  it("normalizes a bare domain to https and leaves a full URL alone", async () => {
    const { normalizeWebsite } = await import("@/services/attendees/attendeeRegistrationService");
    expect(normalizeWebsite("mysite.com")).toBe("https://mysite.com");
    expect(normalizeWebsite("  www.example.org/about ")).toBe("https://www.example.org/about");
    expect(normalizeWebsite("http://legacy.example")).toBe("http://legacy.example");
    expect(normalizeWebsite("")).toBeUndefined();
  });
  it("the form marks required fields and does not use type=url", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../components/venue/PublicEventPage.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/Fields marked .* are required/);
    expect(src).not.toMatch(/"personalWebsite", "Personal website", "url"/);
  });
});
