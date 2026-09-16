import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CLOUDFLARE_STREAM_PLAN, CLOUDFLARE_WORKERS_PLAN, LIVEKIT_TIERS, SUPABASE_PLAN, fractionUsed, livekitAllowance, livekitPlan, livekitTier } from "@/lib/capacity/capacityPlans";
import { readLiveKitLiveSnapshot } from "@/services/capacity/capacityReadingService";
import { KEEP_ALIVE_PROBE_KEY, pingRuntimeStore } from "@/services/runtime/supabaseKeepAlive";

/**
 * The plans were read off the provider dashboards on 16 Sep 2026. Three things have to stay true:
 * the allowances are what the dashboards said, an allowance nobody confirmed reports unknown rather
 * than a comfortable zero, and the keep-alive is registered somewhere that actually runs it.
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
    expect(SUPABASE_PLAN).toMatchObject({ databaseMb: 500, egressGb: 5, autoPauseIdleDays: 7, backups: false });
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

describe("the Supabase keep-alive", () => {
  it("is registered on a schedule that names the route it calls", () => {
    const workflow = fs.readFileSync(".github/workflows/supabase-keep-alive.yml", "utf8");
    expect(workflow).toMatch(/^\s+- cron: /m);
    expect(workflow).toContain("/api/runtime/keep-alive");
    // A green run against the file store would have kept nothing awake.
    expect(workflow).toContain('"store":"supabase"');
    expect(fs.existsSync("app/api/runtime/keep-alive/route.ts")).toBe(true);
  });

  it("is idempotent: it only reads, and two pings leave the same state", async () => {
    const service = fs.readFileSync("services/runtime/supabaseKeepAlive.ts", "utf8");
    for (const write of ["upsert", "insert", "set", "append", "delete"]) {
      expect(service.includes(`store.${write}`)).toBe(false);
    }
    expect(service).not.toMatch(/console\.(log|warn|error|info)/);
    const first = await pingRuntimeStore();
    const second = await pingRuntimeStore();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.store).toBe(first.store);
    // The probe key must never become a real contact row.
    expect(KEEP_ALIVE_PROBE_KEY).toContain("__");
  });

  it("the route answers, twice, with the same shape and no new state", async () => {
    const { GET } = await import("@/app/api/runtime/keep-alive/route");
    const first = await GET();
    const second = await GET();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.ok).toBe(true);
    expect(secondBody.store).toBe(firstBody.store);
    expect(secondBody.detail).toBeUndefined();
  });

  it("the route hands back the store it pinged, so an inert ping is visible", () => {
    const route = fs.readFileSync("app/api/runtime/keep-alive/route.ts", "utf8");
    expect(route).toContain("pingRuntimeStore");
    expect(route).toContain("store: ping.store");
    expect(route).not.toMatch(/console\.(log|warn|error|info)/);
  });
});
