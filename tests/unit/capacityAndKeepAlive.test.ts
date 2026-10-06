import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { CLOUDFLARE_STREAM_PLAN, CLOUDFLARE_WORKERS_PLAN, D1_PLAN, LIVEKIT_TIERS, R2_PLAN, fractionUsed, livekitAllowance, livekitPlan, livekitTier } from "@/lib/capacity/capacityPlans";
import { pingDatabase, readLiveKitLiveSnapshot } from "@/services/capacity/capacityReadingService";
import { setD1ForTests } from "@/lib/d1/binding";
import { createTestD1 } from "./helpers/d1";

/**
 * The plans were read off the provider dashboards on 16 Sep 2026. Three things have to stay true:
 * the allowances are what the dashboards said, an allowance nobody confirmed reports unknown rather
 * than a comfortable zero, and the database reading is a real read (D1 never pauses, so the old
 * keep-alive is gone rather than kept alive for nothing).
 */
describe("LiveKit plan allowances", () => {
  it("Ship carries the numbers the dashboard showed, transcode minutes first", () => {
    const plan = livekitPlan("ship");
    expect(plan.monthlyUsd).toBe(50);
    expect(plan.confirmed).toBe(true);
    expect(plan.allowances[0].key).toBe("transcodeMinutes");
    expect(plan.allowances.map((allowance) => allowance.included)).toEqual([600, 150_000, 250, 1_000]);
    expect(livekitAllowance("transcodeMinutes", "ship").overage.usdPerUnit).toBe(0.02);
    expect(livekitAllowance("participantMinutes", "ship").overage.usdPerUnit).toBe(0.0005);
    expect(livekitAllowance("downstreamGb", "ship").overage.usdPerUnit).toBe(0.12);
    // Concurrency is a ceiling, not a meter: there is no per-unit price to charge past it.
    expect(livekitAllowance("concurrentConnections", "ship").overage.usdPerUnit).toBeNull();
  });

  it("a tier nobody read off the dashboard reports unknown, never zero", () => {
    for (const tier of LIVEKIT_TIERS.filter((name) => name !== "ship")) {
      const plan = livekitPlan(tier);
      expect(plan.confirmed).toBe(false);
      for (const allowance of plan.allowances) {
        expect(allowance.included).toBeNull();
        expect(allowance.included).not.toBe(0);
        expect(allowance.unknownReason.length).toBeGreaterThan(20);
      }
    }
  });

  it("LIVEKIT_TIER selects the plan and an unknown value falls back to Ship rather than to nothing", () => {
    expect(livekitTier({ LIVEKIT_TIER: "scale" })).toBe("scale");
    expect(livekitTier({ LIVEKIT_TIER: "  SHIP " })).toBe("ship");
    expect(livekitTier({ LIVEKIT_TIER: "platinum" })).toBe("ship");
    expect(livekitTier({})).toBe("ship");
  });

  it("the other three plans live here too, so no number is retyped into prose", () => {
    expect(CLOUDFLARE_WORKERS_PLAN).toMatchObject({ monthlyUsd: 5, includedRequests: 10_000_000, cpuMsPerInvocation: 30_000, variablesPerWorker: 128, repoVariableBudget: 60 });
    expect(CLOUDFLARE_STREAM_PLAN).toMatchObject({ usdPerThousandMinutesStored: 5, usdPerThousandMinutesDelivered: 1, liveInputName: "westpeek-fallback" });
    expect(D1_PLAN).toMatchObject({ databaseGb: 5, rowsReadPerMonth: 25_000_000_000, rowsWrittenPerMonth: 50_000_000, idlePause: false });
    expect(R2_PLAN).toMatchObject({ storageGbMonth: 10, classAOpsPerMonth: 1_000_000, classBOpsPerMonth: 10_000_000, egressFees: false });
  });
});

describe("a reading we could not take", () => {
  it("comes back unknown with a reason, not a zero", async () => {
    // No LiveKit credentials in the unit environment: the honest answer is null everywhere.
    // Addressed through the bracket form on purpose: a bare secret-name assignment in a source
    // file is what validate_v5_no_secrets.js hunts for, and it is right to.
    const keys = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
    const previous = keys.map((key) => [key, process.env[key]] as const);
    for (const key of keys) delete process.env[key];
    try {
      const snapshot = await readLiveKitLiveSnapshot();
      expect(snapshot.ok).toBe(false);
      expect(snapshot.ingressesPublishing).toBeNull();
      expect(snapshot.participantsNow).toBeNull();
      expect(snapshot.roomsLive).toBeNull();
      expect(snapshot.ingressesPublishing).not.toBe(0);
      expect(snapshot.detail).toContain("LIVEKIT_URL");
    } finally {
      for (const [key, value] of previous) if (value !== undefined) process.env[key] = value;
    }
  });

  it("the readout draws no bar when either side of the fraction is unknown", () => {
    expect(fractionUsed(null, 600)).toBeNull();
    expect(fractionUsed(120, null)).toBeNull();
    expect(fractionUsed(120, 0)).toBeNull();
    expect(fractionUsed(120, 600)).toBeCloseTo(0.2);
  });

  it("the readout prints the word unknown and the reason, and never formats a null as 0", () => {
    const readout = fs.readFileSync("components/capacity/CapacityReadout.tsx", "utf8");
    expect(readout).toContain('if (reading.value === null) return "unknown"');
    expect(readout).toContain("No bar: the number is unknown");
    expect(readout).toContain("reading.unknownReason");
  });
});

describe("the database reading (D1, no keep-alive)", () => {
  it("the keep-alive workflow, route and service are gone, and nothing calls them", () => {
    expect(fs.existsSync(".github/workflows/supabase-keep-alive.yml")).toBe(false);
    expect(fs.existsSync("app/api/runtime/keep-alive/route.ts")).toBe(false);
    expect(fs.existsSync("services/runtime/supabaseKeepAlive.ts")).toBe(false);
    const callers = execSync("git grep -l -e '/api/runtime/keep-alive' -e 'pingRuntimeStore' -e 'KEEP_ALIVE_PROBE_KEY' -- app components lib services .github || true", { encoding: "utf8" }).trim();
    expect(callers).toBe("");
  });

  it("a real read against a migrated D1 answers yes with the database size", async () => {
    const env = await createTestD1();
    setD1ForTests(env.db);
    try {
      const first = await pingDatabase();
      const second = await pingDatabase();
      expect(first).toMatchObject({ ok: true, detail: "single read succeeded" });
      expect(second.ok).toBe(true);
      expect(typeof first.sizeMb).toBe("number");
      // Reading is all it does: two pings leave the same database.
      expect(second.sizeMb).toBe(first.sizeMb);
    } finally {
      setD1ForTests(undefined);
      await env.dispose();
    }
  }, 30_000);

  it("no binding, or a database that cannot be read, is a no — never a pass", async () => {
    setD1ForTests(undefined);
    expect(await pingDatabase()).toMatchObject({ ok: false, sizeMb: null });
    const bare = await createTestD1({ migrate: false });
    setD1ForTests(bare.db);
    try {
      expect(await pingDatabase()).toMatchObject({ ok: false, detail: expect.stringMatching(/no such table/) });
    } finally {
      setD1ForTests(undefined);
      await bare.dispose();
    }
  }, 30_000);

  it("the readout labels the database section from the D1/R2 plans and links the health probe", () => {
    const readout = fs.readFileSync("components/capacity/CapacityReadout.tsx", "utf8");
    expect(readout).toContain("position.database.map");
    expect(readout).toContain('href="/api/runtime/health"');
    expect(readout).toContain('reading.key === "databaseAnswering"');
  });
});
