import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { createDbClient } from "@/lib/d1/query";
import { setD1ForTests } from "@/lib/d1/binding";
import { D1RuntimeStore } from "@/services/runtime/d1RuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, listEventRecords } from "@/services/events/eventRepository";
import { HEALTH_PROBE_EVENT_ID } from "@/services/events/crewPageReadsProbe";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import { createTestD1 } from "./helpers/d1";

/**
 * /api/runtime/health is PUBLIC. Until 31 Oct 2026 its crew-page probe ran against the newest real
 * client event and returned that event's id — a slug with a person's name in it — to anyone. This
 * pins the repair: with real client events in the store, the public body carries no event id other
 * than the synthetic HEALTH_PROBE_EVENT_ID, no slug, no event or client name, and no email; and the
 * probe still fails by name on a missing table, so the synthetic id did not make it inert.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const IDENTIFYING_KEY = /^(event_?id|eventIds?|slug|email|client.*|eventName|title|code)$/i;
const EMAIL = /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i;

/** Every [path, value] for an identifying key anywhere in the body. */
function identifyingFields(value: unknown, path = "$"): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.flatMap((item, index) => identifyingFields(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(IDENTIFYING_KEY.test(key) ? [[`${path}.${key}`, child] as [string, unknown]] : []),
    ...identifyingFields(child, `${path}.${key}`),
  ]);
}

async function healthBody() {
  const { GET } = await import("@/app/api/runtime/health/route");
  const response = await GET();
  const body = await response.json();
  return { status: response.status, body, text: JSON.stringify(body) };
}

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

describe("public GET /api/runtime/health never names a client event", () => {
  it("carries only the synthetic probe id, with real client events in the store", async () => {
    setD1ForTests(env.db);
    setRuntimeStoreForTests(new D1RuntimeStore(createDbClient(env.db)));
    resetOverlayForTests();
    const created = [
      await createEventRecord({ name: "Pat Example Private Dinner", clientName: "Example Holdings", when: "now" }, owner),
      await createEventRecord({ name: "Robin Sample Virtual Dating Request", when: "now", source: "request" }, owner),
    ];
    const real = (await listEventRecords()).filter((event) => event.source !== "seed");
    expect(real.length).toBeGreaterThanOrEqual(created.length);

    const { status, body, text } = await healthBody();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    // The probe ran: every crew read reported, against the synthetic id and nothing else.
    expect(body.crewPageReads.reads.length).toBeGreaterThanOrEqual(10);
    expect(body.crewPageReads.eventId).toBe(HEALTH_PROBE_EVENT_ID);
    // `reads[].name` is the name of the read (a table), never an event's name.
    for (const read of body.crewPageReads.reads) expect(read.name).toMatch(/^[a-z_]+$/);
    for (const [path, value] of identifyingFields(body)) expect({ path, value }).toEqual({ path: "$.crewPageReads.eventId", value: HEALTH_PROBE_EVENT_ID });
    for (const event of real) {
      for (const needle of [event.id, event.slug, event.name, event.clientName].filter((item): item is string => Boolean(item))) expect(text).not.toContain(needle);
    }
    expect(text).not.toMatch(EMAIL);
  }, 30_000);

  it("still fails by name on a missing crew-page table when keyed on the synthetic id", async () => {
    const broken = await createTestD1();
    try {
      await broken.db.prepare('DROP TABLE "attendee_profiles"').run();
      setD1ForTests(broken.db);
      setRuntimeStoreForTests(new D1RuntimeStore(createDbClient(broken.db)));
      const { status, body } = await healthBody();
      expect(status).toBe(503);
      expect(body.crewPageReads.ok).toBe(false);
      expect(body.crewPageReads.reads).toEqual(expect.arrayContaining([expect.objectContaining({ name: "attendee_profiles", ok: false })]));
    } finally {
      await broken.dispose();
    }
  }, 30_000);
});
