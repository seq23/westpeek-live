import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two things that were true but unproven on 16 Sep 2026: a migration only reached production
 * through a mirror directory (0030 shipped without one and "Archive test rows" pressed against a
 * column that was not there — since 6 Oct 2026 there is one schema home, migrations-d1/), and the build watchdog only ran inside the venue, so a
 * deploy that swapped the chunks under an open /app page threw a client-side exception.
 */
describe("the schema has one home: migrations-d1, applied before every deploy", () => {
  it("no mirror and no second schema directory exists to drift", () => {
    expect(fs.existsSync("supabase")).toBe(false);
    expect(fs.existsSync("db/migrations")).toBe(false);
    const files = fs.readdirSync("migrations-d1").filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
    expect(files).toEqual(["0001_core.sql", "0002_approvals_inbox.sql", "0003_runtime.sql", "0004_attendees_live.sql", "0005_networking_email.sql", "0006_events_audit_auth.sql"]);
    const deploy = fs.readFileSync(".github/workflows/deploy-cloudflare-worker.yml", "utf8");
    expect(deploy.indexOf("d1 migrations apply west-peek-live --remote")).toBeGreaterThan(0);
    expect(deploy.indexOf("d1 migrations apply west-peek-live --remote")).toBeLessThan(deploy.indexOf("npm run cf:deploy"));
  });

  it("contacts.archived_at exists in the D1 schema and nothing hard-deletes a contact", () => {
    const sql = fs.readFileSync("migrations-d1/0001_core.sql", "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS contacts \([\s\S]*?\n  archived_at TEXT,/);
    for (const file of fs.readdirSync("migrations-d1")) expect(fs.readFileSync(path.join("migrations-d1", file), "utf8").toLowerCase()).not.toContain("delete from");
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
    expect(service).toContain("npx wrangler d1 migrations apply west-peek-live --remote");
    expect(fs.readFileSync("components/people/ArchiveTestRowsButton.tsx", "utf8")).toContain("archive-test-rows-failed");
    expect(fs.readFileSync("services/events/crewPageReadsProbe.ts", "utf8")).toContain("contacts_archived_at");
  });
});
