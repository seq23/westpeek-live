import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { navMarkerFor, EMPTY_VENUE_ACTIVITY, type VenueActivity } from "@/services/venue/venueActivityService";

function source(relative: string) {
  return readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
}

describe("the profile card no longer sits inside the chat rail", () => {
  it("the stage rail holds the chat and nothing that can overflow the row onto My Agenda", () => {
    const stage = source("components/venue/MainStageExperience.tsx");
    const railStart = stage.indexOf("<StageChatSheet");
    const rail = stage.slice(railStart, stage.indexOf("</div>", railStart));
    expect(railStart, "the stage must still render the chat").toBeGreaterThan(-1);
    expect(rail).not.toContain("EditAttendeeProfilePanel");
    // Full width, under the stage, so a seven-field form is not squeezed into a 24rem rail.
    expect(stage).toMatch(/<SafeSection label="Tell us more"/);
    expect(stage).toContain("grid items-start");
  });

  it("no chat claims h-full, which is what overflowed the stretched rail", () => {
    expect(source("components/venue/LiveRoomChat.tsx")).not.toMatch(/className="[^"]*\bh-full\b/);
  });

  it("the tell-us-more anchor and its test ids survived the move", () => {
    const panel = source("components/venue/EditAttendeeProfilePanel.tsx");
    for (const token of ['id="tell-us-more"', 'testId="attendee-profile-panel"', 'data-testid="tell-us-more-progress"', 'data-testid="tell-us-more-save"']) {
      expect(panel, token).toContain(token);
    }
    expect(source("components/venue/VenueHeader.tsx")).toContain("lobby#tell-us-more");
    // A link to a closed section has to open it, or the header link lands on nothing.
    expect(source("components/venue/VenueSection.tsx")).toContain("hashchange");
  });
});

describe("no attendee-facing time renders a UTC suffix", () => {
  it("every venue surface formats through LocalTime or LocalTimeWindow", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.tsx$/.test(name)) continue;
        const body = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        if (/timeZoneName/.test(body) || /\bUTC\b/.test(body) || /formatSessionWindow\(/.test(body)) offenders.push(p);
      }
    };
    for (const root of ["components/venue", "app/venue"]) walk(new URL(`../../${root}`, import.meta.url).pathname);
    expect(offenders).toEqual([]);
  });

  it("the window component labels its pre-hydration paint and drops the label once the browser answers", () => {
    const src = source("components/shared/LocalTimeWindow.tsx");
    expect(src).toContain('windowText(startsAt, endsAt, "UTC")');
    expect(src).toContain("useEffect(() => { setText(windowText(startsAt, endsAt)); }");
  });
});

describe("nav markers appear only when their signal is genuinely true", () => {
  const quiet: VenueActivity = EMPTY_VENUE_ACTIVITY;
  it("an empty venue wears no markers at all", () => {
    for (const surface of ["stage", "networking", "expo", "breakouts", "replay", "people", "lobby", "help", "sessions", "run-of-show"] as const) {
      expect(navMarkerFor(surface, quiet), surface).toBeUndefined();
    }
  });

  it("a zero count is never a marker", () => {
    const zeros: VenueActivity = { ...quiet, boothCount: 0, breakoutsOpen: 0, replaysReady: 0, peopleListed: 0 };
    expect(navMarkerFor("expo", zeros)).toBeUndefined();
    expect(navMarkerFor("replay", zeros)).toBeUndefined();
  });

  it("closed networking wears nothing; open networking says open, and says the queue when there is one", () => {
    expect(navMarkerFor("networking", { ...quiet, networkingOpen: false, networkingQueueSize: 4 })).toBeUndefined();
    expect(navMarkerFor("networking", { ...quiet, networkingOpen: true })).toEqual({ label: "Open", tone: "open" });
    expect(navMarkerFor("networking", { ...quiet, networkingOpen: true, networkingQueueSize: 3 })).toEqual({ label: "3 waiting", tone: "open" });
  });

  it("the stage is marked live only when the stage is live", () => {
    expect(navMarkerFor("stage", quiet)).toBeUndefined();
    expect(navMarkerFor("stage", { ...quiet, stageLive: true })).toEqual({ label: "Live", tone: "live" });
  });
});

describe("the run of show opens without navigation", () => {
  it("the strip is on every venue page through the shell, and the standalone route still answers", () => {
    const shell = source("components/venue/VenuePageShell.tsx");
    expect(shell).toContain("<RunOfShowStrip");
    expect(shell).toContain("attendeeRunOfShowView");
    // No schedule renders nothing rather than an error bar across every page.
    expect(shell).toContain("runOfShow?.total");
    expect(() => source("app/venue/[eventId]/run-of-show/page.tsx")).not.toThrow();
    expect(source("AUTHENTICATED_ROUTE_MANIFEST.md")).toContain("`/venue/[eventId]/run-of-show`");
  });

  it("the strip collapses in place and never navigates to read it", () => {
    const strip = source("components/venue/RunOfShowStrip.tsx");
    expect(strip).toContain('data-testid="run-of-show-strip-toggle"');
    expect(strip).toContain("localStorage");
    expect(strip).toContain("motion-safe:transition-transform");
  });

  it("no guest surface can read a producer field", () => {
    for (const file of ["services/run-of-show/attendeeRunOfShow.ts", "components/venue/RunOfShowStrip.tsx", "components/venue/AttendeeRunOfShow.tsx"]) {
      const body = source(file);
      for (const leak of ["technicalCues", "producerNotes", "backupPlan", "emergencyNotes", "liveNotes"]) {
        expect(body, `${file} must not read ${leak}`).not.toContain(leak);
      }
    }
  });
});
