import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";
import { createDbClient } from "@/lib/d1/query";
import { setD1ForTests } from "@/lib/d1/binding";
import { D1RuntimeStore } from "@/services/runtime/d1RuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { probeMigrationCoverageOn } from "@/services/runtime/migrationCoverageProbe";
import { probeCrewPageReads } from "@/services/events/crewPageReadsProbe";
import { RUNTIME_TABLE_MIGRATIONS } from "@/types/runtimeEvent";
import { D1_SCHEMA } from "@/lib/d1/schema.generated";
import type { RuntimeStore } from "@/services/runtime/runtimeStore";
import { createTestD1 } from "./helpers/d1";

/**
 * /api/runtime/health never swallows: an unreachable store is ok:false AND a 503, the coverage probe
 * checks every table and column migrations-d1 declares, and the crew probe fails (instead of
 * reporting "nothing to probe yet") when the event list itself cannot be read. 6 Oct 2026: the
 * Supabase project was deleted and the old probe kept answering 200.
 */
let env: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
  env = await createTestD1();
}, 60_000);

afterAll(async () => {
  await env?.dispose();
});

afterEach(() => {
  setRuntimeStoreForTests(undefined);
  setD1ForTests(undefined);
});

function unreachableStore(): RuntimeStore {
  return new Proxy({ kind: "d1" } as RuntimeStore, {
    get(target, prop) {
      if (prop === "kind") return "d1";
      if (prop === "then") return undefined;
      return () => Promise.reject(new Error("D1 runtime store failed: network connection lost"));
    },
  });
}

describe("migration coverage", () => {
  it("is derived from migrations-d1 and covers every table and column", () => {
    const tables = Object.keys(D1_SCHEMA);
    const columns = tables.reduce((sum, table) => sum + Object.keys(D1_SCHEMA[table].columns).length, 0);
    expect(tables.length).toBeGreaterThanOrEqual(60);
    expect(Object.keys(RUNTIME_TABLE_MIGRATIONS)).toHaveLength(tables.length + columns);
    for (const table of ["request_event_intake", "runtime_events", "event_assets", "auth_users", "auth_sessions", "auth_password_resets"]) expect(RUNTIME_TABLE_MIGRATIONS[table]).toMatch(/^migrations-d1\/000[1-6]_[a-z_]+\.sql$/);
  });

  it("passes on a fully migrated D1 and checks every object", async () => {
    const probe = await probeMigrationCoverageOn(env.db);
    expect(probe).toMatchObject({ ok: true, missing: [] });
    expect(probe.checked).toBe(Object.keys(RUNTIME_TABLE_MIGRATIONS).length);
  });

  it("names a missing column and a missing table with the file that supplies them", async () => {
    const broken = await createTestD1();
    try {
      await broken.db.prepare('DROP INDEX "contacts_archived_at_idx"').run();
      await broken.db.prepare('ALTER TABLE "contacts" DROP COLUMN "archived_at"').run();
      await broken.db.prepare('DROP TABLE "how_it_works_pages"').run();
      const probe = await probeMigrationCoverageOn(broken.db);
      expect(probe.ok).toBe(false);
      expect(probe.missing).toEqual(expect.arrayContaining([
        expect.objectContaining({ object: "contacts.archived_at", migrationFile: "migrations-d1/0001_core.sql" }),
        expect.objectContaining({ object: "how_it_works_pages", migrationFile: "migrations-d1/0003_runtime.sql" }),
      ]));
    } finally {
      await broken.dispose();
    }
  }, 30_000);
});

describe("the crew-page probe", () => {
  it("fails when the store cannot list events, instead of reporting nothing to probe", async () => {
    setRuntimeStoreForTests(unreachableStore());
    const probe = await probeCrewPageReads();
    expect(probe.ok).toBe(false);
    expect(probe.reads[0]).toMatchObject({ name: "runtime_events", ok: false, detail: expect.stringMatching(/network connection lost/) });
  });
});

describe("GET /api/runtime/health", () => {
  it("answers 503 with ok:false when the store is unreachable", async () => {
    setRuntimeStoreForTests(unreachableStore());
    const { GET } = await import("@/app/api/runtime/health/route");
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.crewPageReads.ok).toBe(false);
  });

  it("answers 200 with ok:true on a migrated, reachable D1", async () => {
    setD1ForTests(env.db);
    setRuntimeStoreForTests(new D1RuntimeStore(createDbClient(env.db)));
    const { GET } = await import("@/app/api/runtime/health/route");
    const response = await GET();
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, store: "d1", migrationCoverage: { ok: true } });
    expect(response.status).toBe(200);
  });
});
