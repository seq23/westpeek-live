import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { RUNTIME_TABLE_MIGRATIONS } from "@/types/runtimeEvent";
import { D1_SCHEMA } from "@/lib/d1/schema.generated";

/**
 * RUNTIME_TABLE_MIGRATIONS is what /api/runtime/health probes. Until 17 Sep 2026 it was kept by hand
 * and skipped 0023, 0031, 0032, 0035 and 0038; three migrations reached production unapplied behind
 * that gap. Since 6 Oct 2026 it is DERIVED from migrations-d1 (via lib/d1/schema.generated.ts), so
 * these behaviours must not quietly regress: the map is exactly the SQL, the generated manifest is
 * never stale, the validator says so by count, and every probe refuses to pass on an empty loop.
 */
function run(script: string, args: string[] = []): { code: number; output: string } {
  try {
    const output = execFileSync("node", [script, ...args], { encoding: "utf8", stdio: "pipe" });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout || ""}${failure.stderr || ""}` };
  }
}

/** The same parse, from the SQL, so the test fails on the SQL rather than on the manifest. */
function objectsDeclaredBySql(): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of fs.readdirSync("migrations-d1").filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) {
    const sql = fs.readFileSync(`migrations-d1/${name}`, "utf8");
    for (const m of Array.from(sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(\n([\s\S]*?)\n\);/g))) {
      out.set(m[1], `migrations-d1/${name}`);
      for (const line of m[2].split("\n")) {
        const col = /^\s+([a-z_][a-z0-9_]*) (TEXT|INTEGER|REAL)\b/.exec(line);
        if (col) out.set(`${m[1]}.${col[1]}`, `migrations-d1/${name}`);
      }
    }
  }
  return out;
}

describe("the runtime migration map cannot be forgotten", () => {
  it("is exactly every table and column migrations-d1 declares, pointing at the right file", () => {
    const declared = objectsDeclaredBySql();
    expect(declared.size).toBeGreaterThan(700);
    expect(new Set(Object.keys(RUNTIME_TABLE_MIGRATIONS))).toEqual(new Set(declared.keys()));
    for (const [key, file] of Array.from(declared.entries())) expect(RUNTIME_TABLE_MIGRATIONS[key], key).toBe(file);
  });

  it("carries the objects that once shipped unapplied, and the new login tables", () => {
    expect(RUNTIME_TABLE_MIGRATIONS["request_event_intake"]).toBe("migrations-d1/0003_runtime.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["event_assets"]).toBe("migrations-d1/0003_runtime.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["runtime_email_sends"]).toBe("migrations-d1/0005_networking_email.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["runtime_event_templates"]).toBe("migrations-d1/0003_runtime.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["runtime_events.attendee_session_days"]).toBe("migrations-d1/0003_runtime.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["contacts.archived_at"]).toBe("migrations-d1/0001_core.sql");
    expect(RUNTIME_TABLE_MIGRATIONS["attendee_sessions.client_build_id"]).toBe("migrations-d1/0004_attendees_live.sql");
    for (const table of ["auth_users", "auth_sessions", "auth_password_resets"]) expect(RUNTIME_TABLE_MIGRATIONS[table]).toBe("migrations-d1/0006_events_audit_auth.sql");
    expect(Object.keys(D1_SCHEMA)).toHaveLength(60);
  });

  it("the generated manifest is current and the schema validator passes with its count", () => {
    expect(run("scripts/generate_d1_schema_manifest.mjs", ["--check"])).toMatchObject({ code: 0 });
    const { code, output } = run("scripts/validate_d1_schema_parity.js");
    expect(output).toMatch(/validate_d1_schema_parity: PASS — \d+ checks: 6 migration files, 60 tables, \d+ columns/);
    expect(code).toBe(0);
  });

  it("the schema validator proves itself: four breakages caught, a clean copy passes", () => {
    const { code, output } = run("scripts/validate_d1_schema_parity.js", ["--self-test"]);
    expect(output).toContain("4 breakages caught, clean copy passes");
    expect(code).toBe(0);
    const script = fs.readFileSync("scripts/validate_d1_schema_parity.js", "utf8");
    expect(script).toContain("zero migration files");
    expect(script).toContain("found zero tables named");
    expect(script).toContain("is stale");
  });
});

describe("a database behind its migrations is a failure, never a warning", () => {
  it("the health route folds migrationCoverage into ok, answers 503 when not ok, and never swallows a thrown probe", () => {
    const route = fs.readFileSync("app/api/runtime/health/route.ts", "utf8");
    expect(route).toContain("probeMigrationCoverage");
    expect(route).toContain("crewPageReads.ok && migrationCoverage.ok");
    expect(route).toContain("ok: false, checked: 0");
    expect(route).toContain("status: ok ? 200 : 503");
  });

  it("the probe refuses to report health for an empty map, a file store, or an empty loop", () => {
    const probe = fs.readFileSync("services/runtime/migrationCoverageProbe.ts", "utf8");
    expect(probe).toContain("RUNTIME_TABLE_MIGRATIONS is empty");
    expect(probe).toContain('getRuntimeStore().kind !== "d1"');
    expect(probe).toContain("checked zero objects");
    // One batch for every table, not one request per object.
    expect(probe).toContain("db.batch(tables.map(");
  });

  it("the post-deploy smoke test stops the deploy and names the command to run", () => {
    const smoke = fs.readFileSync("scripts/post_deploy_smoke_test.js", "utf8");
    expect(smoke).toContain("NAMED STOP — the deployed database is missing");
    expect(smoke).toContain("migrationCoverage missing from runtime health");
    expect(smoke).toContain("migration coverage checked 0 objects");
    expect(smoke).toContain("npx wrangler d1 migrations apply west-peek-live --remote");
    expect(smoke).toContain('health.store !== "d1"');
  });

  it("the deploy workflow applies the migrations before the Worker, on green main", () => {
    const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare-worker.yml", "utf8");
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    const apply = workflow.indexOf("npx wrangler d1 migrations apply west-peek-live --remote");
    expect(apply).toBeGreaterThan(0);
    expect(apply).toBeLessThan(workflow.indexOf("npm run cf:deploy -- --keep-vars"));
    expect(fs.readFileSync("wrangler.jsonc", "utf8")).toMatch(/"migrations_dir": "migrations-d1"/);
  });
});
