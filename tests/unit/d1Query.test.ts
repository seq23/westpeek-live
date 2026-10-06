import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient, type DbClient } from "@/lib/d1/query";
import { createTestD1 } from "./helpers/d1";

/** The query layer: one parameterised statement per chain, typed columns, and no unsafe shapes. */
let env: Awaited<ReturnType<typeof createTestD1>>;
let db: DbClient;

beforeAll(async () => {
  env = await createTestD1();
  db = createDbClient(env.db);
}, 60_000);
afterAll(async () => env?.dispose());

describe("d1 query layer", () => {
  it("stores JSON and boolean columns as TEXT and 0/1 and returns them as values", async () => {
    await db.from("runtime_agency_settings").upsert({ id: "a", agency_name: "A", primary_color: "#1", accent_color: "#2", members: [{ n: 1 }], updated_by: "o", updated_by_label: "O", updated_at: "2026-10-06T00:00:00.000Z" });
    const raw = await env.db.prepare('SELECT "members" FROM "runtime_agency_settings"').all<{ members: string }>();
    expect(raw.results[0].members).toBe('[{"n":1}]');
    expect((await db.from("runtime_agency_settings").select("members").eq("id", "a").single()).data).toEqual({ members: [{ n: 1 }] });
    await db.from("runtime_events").insert({ id: "e", slug: "e", name: "E", join_code: "j", crew_code: "c", speaker_code: "s", sponsor_code: "p", vip_code: "v", client_code: "k", registration_enabled: true, created_by: "o", created_by_label: "O" });
    expect((await env.db.prepare('SELECT "registration_enabled" AS r FROM "runtime_events"').all<{ r: number }>()).results[0].r).toBe(1);
    expect((await db.from("runtime_events").select("*").eq("id", "e").maybeSingle()).data).toMatchObject({ registration_enabled: true, branding: {}, sessions: [] });
  });

  it("mints an id for a table whose Postgres default was gen_random_uuid()", async () => {
    const { data } = await db.from("agencies").insert({ name: "Agency", slug: "agency" }).select("*").single();
    expect(data.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns errors as values, refuses unsafe identifiers, unfiltered writes and unsupported or() clauses", async () => {
    expect((await db.from("no_such_table").select("*")).error).toMatchObject({ code: "D1_NO_TABLE" });
    expect((await db.from("runtime_events").select("nope")).error).toMatchObject({ code: "D1_NO_COLUMN" });
    expect((await db.from("runtime_events").select("id; DROP TABLE x")).error?.message).toMatch(/refused identifier/);
    expect((await db.from("runtime_events").update({ name: "x" })).error?.message).toMatch(/no filter/);
    expect((await db.from("runtime_events").delete()).error?.message).toMatch(/no filter/);
    expect((await db.from("runtime_events").select("*").or("id.in.(a,b)")).error?.message).toMatch(/unsupported or\(\)/);
    // A value is always a bound parameter: a quote in it is data, not SQL.
    expect((await db.from("runtime_events").select("*").eq("slug", "e' OR '1'='1")).data).toEqual([]);
  });

  it("maybeSingle errors on more than one row, single on zero", async () => {
    await db.from("runtime_clients").insert([
      { id: "c1", slug: "c1", name: "Same", created_by: "o", created_by_label: "O" },
      { id: "c2", slug: "c2", name: "Same", created_by: "o", created_by_label: "O" },
    ]);
    expect((await db.from("runtime_clients").select("*").eq("name", "Same").maybeSingle()).error?.message).toMatch(/at most one row/);
    expect((await db.from("runtime_clients").select("*").eq("name", "None").single()).error?.message).toMatch(/exactly one row/);
    expect((await db.from("runtime_clients").select("*").eq("name", "None").maybeSingle()).data).toBeNull();
  });
});
