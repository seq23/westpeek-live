import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two things that were true but unproven on 16 Sep 2026: a migration only reaches production
 * through supabase/migrations (0030 shipped without a mirror and "Archive test rows" pressed
 * against a column that was not there), and the build watchdog only ran inside the venue, so a
 * deploy that swapped the chunks under an open /app page threw a client-side exception.
 */
describe("every migration from 0025 on is mirrored for the Supabase integration", () => {
  it("has a byte-identical mirror per canonical migration", () => {
    const canonical = fs.readdirSync("db/migrations").filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) >= 25).sort();
    const mirrors = fs.readdirSync("supabase/migrations");
    expect(canonical.length).toBeGreaterThanOrEqual(6);
    for (const name of canonical) {
      const suffix = name.replace(/^\d{4}_/, "");
      const mirror = mirrors.find((file) => file.endsWith(`_${suffix}`));
      expect(mirror, `${name} has no supabase/migrations mirror`).toBeTruthy();
      expect(fs.readFileSync(path.join("supabase/migrations", mirror!), "utf8")).toBe(fs.readFileSync(path.join("db/migrations", name), "utf8"));
    }
  });

  it("0030 adds contacts.archived_at idempotently and nothing hard-deletes a contact", () => {
    const sql = fs.readFileSync("db/migrations/0030_contact_archive.sql", "utf8");
    expect(sql).toContain("add column if not exists archived_at");
    expect(sql.toLowerCase()).not.toContain("delete from");
  });
});

describe("the build watchdog covers the workspace and the crew deck, not only the venue", () => {
  it("is mounted with a poller in AppShell and the crew event layout", () => {
    for (const file of ["components/layout/AppShell.tsx", "app/crew/events/[eventId]/layout.tsx", "components/venue/VenuePageShell.tsx"]) {
      expect(fs.readFileSync(file, "utf8"), file).toContain("BuildVersionWatchdog");
    }
    for (const file of ["components/layout/AppShell.tsx", "app/crew/events/[eventId]/layout.tsx"]) {
      expect(fs.readFileSync(file, "utf8"), file).toContain("BuildVersionPoller");
    }
    const route = fs.readFileSync("app/api/runtime/build-id/route.ts", "utf8");
    expect(route).toContain("CURRENT_BUILD_ID");
    expect(route).toContain('"cache-control": "no-store"');
  });

  it("the poller only asks while the tab is visible and never throws on a failed fetch", () => {
    const poller = fs.readFileSync("components/system/BuildVersionPoller.tsx", "utf8");
    expect(poller).toContain('document.visibilityState !== "visible"');
    expect(poller).toContain("catch");
  });
});

describe("archiving test rows fails loudly when the column is missing", () => {
  it("the service throws and the button shows it", () => {
    const service = fs.readFileSync("services/attendees/peopleDirectoryService.ts", "utf8");
    expect(service).toContain("The archive did not stick");
    expect(service).toContain("0030_contact_archive.sql");
    expect(fs.readFileSync("components/people/ArchiveTestRowsButton.tsx", "utf8")).toContain("archive-test-rows-failed");
    expect(fs.readFileSync("services/events/crewPageReadsProbe.ts", "utf8")).toContain("contacts_archived_at");
  });
});
