import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { RUNTIME_TABLE_MIGRATIONS } from "@/types/runtimeEvent";

/**
 * RUNTIME_TABLE_MIGRATIONS is what /api/runtime/health probes, and until 17 Sep 2026 it was kept by
 * hand: 0023, 0031, 0032, 0035 and 0038 had no entry, so nothing ever looked for the objects they
 * create. Three migrations reached production unapplied behind that gap and each was found by
 * accident — 0023 being the base table of the whole Plan-an-event path.
 *
 * These are the behaviours that must not quietly regress: the map covers the SQL, the validator says
 * so by name, and every probe on the path refuses to pass on an empty loop.
 */
const MAP_FLOOR = 23;

function runValidator(): { code: number; output: string } {
  try {
    const output = execFileSync("node", ["scripts/validate_migration_map_coverage.js"], { encoding: "utf8" });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout || ""}${failure.stderr || ""}` };
  }
}

/** The same parse the validator does, kept here so the test fails on the SQL rather than on the map. */
function objectsIntroducedBySql(): Map<string, string> {
  const out = new Map<string, string>();
  const names = fs.readdirSync("db/migrations").filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
  for (const name of names) {
    if (Number(name.slice(0, 4)) < MAP_FLOOR) continue;
    const statements = fs.readFileSync(`db/migrations/${name}`, "utf8").split("\n").map((line) => line.replace(/--.*$/, "")).join("\n").toLowerCase().split(";");
    const createdHere = new Set<string>();
    for (const statement of statements) {
      for (const match of Array.from(statement.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/g))) {
        createdHere.add(match[1]);
        if (!out.has(match[1])) out.set(match[1], `db/migrations/${name}`);
      }
    }
    for (const statement of statements) {
      const target = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/.exec(statement);
      if (!target || createdHere.has(target[1])) continue;
      for (const match of Array.from(statement.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/g))) {
        const key = `${target[1]}.${match[1]}`;
        if (!out.has(key)) out.set(key, `db/migrations/${name}`);
      }
    }
  }
  return out;
}

describe("the runtime migration map cannot be forgotten", () => {
  it("covers every table and column migrations 0023 on introduce, pointing at the right file", () => {
    const introduced = objectsIntroducedBySql();
    expect(introduced.size).toBeGreaterThan(40);
    for (const [key, migrationFile] of Array.from(introduced.entries())) {
      expect(RUNTIME_TABLE_MIGRATIONS[key], `${migrationFile} introduces ${key} with no map entry`).toBe(migrationFile);
    }
  });

  it("carries the entries for the five migrations that had none, and the three that shipped unapplied", () => {
    expect(RUNTIME_TABLE_MIGRATIONS["request_event_intake"]).toBe("db/migrations/0023_request_event_intake.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["event_assets"]).toBe("db/migrations/0031_event_assets.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["runtime_email_sends"]).toBe("db/migrations/0032_email_send_log.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["runtime_event_templates"]).toBe("db/migrations/0035_event_templates.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["runtime_events.attendee_session_days"]).toBe("db/migrations/0038_attendee_session_lifetime.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["contacts.archived_at"]).toBe("db/migrations/0030_contact_archive.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["attendee_sessions.client_build_id"]).toBe("db/migrations/0037_attendee_client_telemetry.sql");
  });

  it("the validator passes today and reports how many objects it checked", () => {
    const { code, output } = runValidator();
    expect(output).toContain("validate_migration_map_coverage: PASS");
    expect(output).toMatch(/\d+ tables and columns/);
    expect(code).toBe(0);
  });

  it("the validator hard-fails when it examines zero migrations", () => {
    // Proved out of tree so the repo is never left in the broken state this asserts on.
    const script = fs.readFileSync("scripts/validate_migration_map_coverage.js", "utf8");
    expect(script).toContain("examined zero migrations");
    expect(script).toContain("checked zero objects");
    expect(script).toContain("is stale");
  });
});

describe("a database behind its migrations is a failure, never a warning", () => {
  it("the health route folds migrationCoverage into ok and never swallows a thrown probe", () => {
    const route = fs.readFileSync("app/api/runtime/health/route.ts", "utf8");
    expect(route).toContain("probeMigrationCoverage");
    expect(route).toContain("crewPageReads.ok && migrationCoverage.ok");
    expect(route).toContain("ok: false, checked: 0");
  });

  it("the probe refuses to report health for an empty map, a file store, or an empty loop", () => {
    const probe = fs.readFileSync("services/runtime/migrationCoverageProbe.ts", "utf8");
    expect(probe).toContain("RUNTIME_TABLE_MIGRATIONS is empty");
    expect(probe).toContain('getRuntimeStore().kind !== "supabase"');
    expect(probe).toContain("checked zero objects");
    // One read per table, not one per object: the Worker has a subrequest budget.
    expect(probe).toContain("groupByTable");
  });

  it("the post-deploy smoke test stops the deploy and names the file to run", () => {
    const smoke = fs.readFileSync("scripts/post_deploy_smoke_test.js", "utf8");
    expect(smoke).toContain("NAMED STOP — the deployed database is missing");
    expect(smoke).toContain("migrationCoverage missing from runtime health");
    expect(smoke).toContain("migration coverage checked 0 objects");
    expect(smoke).toContain("docs/manual-notes/migration-assurance.md");
  });

  it("CI reads the Supabase integration's own verdict on a push to main", () => {
    const workflow = fs.readFileSync(".github/workflows/supabase-migration-apply.yml", "utf8");
    expect(workflow).toContain("scripts/supabase_apply_verdict.js");
    expect(workflow).toContain("branches: [main]");
    const verdict = fs.readFileSync("scripts/supabase_apply_verdict.js", "utf8");
    expect(verdict).toContain('select(.app.slug=="supabase")');
    // Every terminal state matched, so a crash cannot read as "still running".
    expect(verdict).toContain('"failure", "timed_out", "cancelled", "action_required", "stale"');
    expect(verdict).toContain("Supabase never applied this migration");
  });

  it("the verdict rule is replayed on every pull request, so it cannot rot unexercised", () => {
    const workflow = fs.readFileSync(".github/workflows/supabase-migration-apply.yml", "utf8");
    for (const state of ["--verdict success", "--verdict failure --changed-migrations true", "--verdict skipped --changed-migrations true", "--verdict skipped --changed-migrations false", "--verdict something_new"]) {
      expect(workflow, `the replay job does not cover ${state}`).toContain(state);
    }
  });

  it("the verdict script decides every terminal state the same way CI replays it", () => {
    const cases: Array<[number, string[]]> = [
      [0, ["--verdict", "success"]],
      [0, ["--verdict", "neutral"]],
      [1, ["--verdict", "failure", "--changed-migrations", "true"]],
      [1, ["--verdict", "failure", "--changed-migrations", "false"]],
      [1, ["--verdict", "skipped", "--changed-migrations", "true"]],
      [0, ["--verdict", "skipped", "--changed-migrations", "false"]],
      [1, ["--verdict", "something_new", "--changed-migrations", "false"]],
    ];
    for (const [want, args] of cases) {
      let code = 0;
      try {
        execFileSync("node", ["scripts/supabase_apply_verdict.js", ...args], { encoding: "utf8", stdio: "pipe" });
      } catch (error) {
        code = (error as { status?: number }).status ?? 1;
      }
      expect(code, `${args.join(" ")} should exit ${want}`).toBe(want);
    }
  });
});
