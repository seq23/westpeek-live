/**
 * WHAT THE PLANS ACTUALLY INCLUDE — one place, so nobody retypes a number into prose again.
 *
 * Read off the provider dashboards on 16 Sep 2026. The LiveKit Ship row is the one that matters on
 * show day: transcode minutes are the first cliff, because every minute of StreamYard feed pushed
 * into an ingress burns one whether five people watch or five hundred do.
 *
 * An allowance we have NOT read from a dashboard carries `included: null` and a reason. It is never
 * written as 0 and never guessed: a fabricated allowance is worse than an honest "unknown", because
 * the readout would draw a comfortable bar against a number nobody checked.
 */
export type LiveKitTier = "build" | "ship" | "scale";

export const LIVEKIT_TIERS: readonly LiveKitTier[] = ["build", "ship", "scale"] as const;

export type AllowanceKey =
  | "transcodeMinutes"
  | "participantMinutes"
  | "downstreamGb"
  | "concurrentConnections";

export interface Allowance {
  key: AllowanceKey;
  /** How the owner reads it, not how the provider bills it. */
  label: string;
  /** Included in the plan each month, or null when it has not been confirmed from the dashboard. */
  included: number | null;
  unit: string;
  /** Why `included` is null, in the owner's words. Empty string when the number is a real reading. */
  unknownReason: string;
  /** What one unit past the allowance costs, and how to say it. `usdPerUnit` is null for a hard ceiling. */
  overage: { usdPerUnit: number | null; note: string };
}

export interface LiveKitPlan {
  tier: LiveKitTier;
  label: string;
  monthlyUsd: number | null;
  /** True only where every allowance came off the dashboard. */
  confirmed: boolean;
  /** Transcode minutes FIRST: it is the cliff we hit before any of the others. */
  allowances: Allowance[];
}

const NOT_READ = "Not read from the LiveKit dashboard — only the Ship plan was. Put the plan page's numbers here before switching LIVEKIT_TIER to it.";

function unreadAllowances(): Allowance[] {
  return [
    { key: "transcodeMinutes", label: "Transcode minutes", included: null, unit: "min", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
    { key: "participantMinutes", label: "WebRTC participant-minutes", included: null, unit: "participant-min", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
    { key: "downstreamGb", label: "Downstream bandwidth", included: null, unit: "GB", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
    { key: "concurrentConnections", label: "Concurrent connections", included: null, unit: "connections", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
  ];
}

const LIVEKIT_PLANS: Record<LiveKitTier, LiveKitPlan> = {
  build: { tier: "build", label: "LiveKit Build (free)", monthlyUsd: 0, confirmed: false, allowances: unreadAllowances() },
  ship: {
    tier: "ship",
    label: "LiveKit Ship",
    monthlyUsd: 50,
    confirmed: true,
    allowances: [
      { key: "transcodeMinutes", label: "Transcode minutes", included: 600, unit: "min", unknownReason: "", overage: { usdPerUnit: 0.02, note: "$0.02 per transcode minute (video) past 600." } },
      { key: "participantMinutes", label: "WebRTC participant-minutes", included: 150_000, unit: "participant-min", unknownReason: "", overage: { usdPerUnit: 0.0005, note: "$0.0005 per participant-minute past 150,000." } },
      { key: "downstreamGb", label: "Downstream bandwidth", included: 250, unit: "GB", unknownReason: "", overage: { usdPerUnit: 0.12, note: "$0.12 per GB past 250." } },
      { key: "concurrentConnections", label: "Concurrent connections", included: 1_000, unit: "connections", unknownReason: "", overage: { usdPerUnit: null, note: "A ceiling, not an overage: the 1,001st connection is refused." } },
    ],
  },
  scale: { tier: "scale", label: "LiveKit Scale", monthlyUsd: null, confirmed: false, allowances: unreadAllowances() },
};

/** The plan we are on. Defaults to Ship — the plan the account was actually on, 16 Sep 2026. */
export function livekitTier(env: Record<string, string | undefined> = process.env): LiveKitTier {
  const raw = (env.LIVEKIT_TIER || "").trim().toLowerCase();
  return (LIVEKIT_TIERS as readonly string[]).includes(raw) ? (raw as LiveKitTier) : "ship";
}

export function livekitPlan(tier: LiveKitTier = livekitTier()): LiveKitPlan {
  return LIVEKIT_PLANS[tier];
}

export function livekitAllowance(key: AllowanceKey, tier: LiveKitTier = livekitTier()): Allowance {
  return livekitPlan(tier).allowances.find((allowance) => allowance.key === key)!;
}

/**
 * Cloudflare Workers Paid, $5/mo. The 128-variable cap is the plan's; the repo holds itself to 60
 * (scripts/validate_worker_variable_budget.js), which is the number that actually bites first.
 */
export const CLOUDFLARE_WORKERS_PLAN = {
  label: "Cloudflare Workers Paid",
  monthlyUsd: 5,
  includedRequests: 10_000_000,
  cpuMsPerInvocation: 30_000,
  variablesPerWorker: 128,
  /** The repo's own ceiling, well under the plan's, so a show-day secret always has a slot. */
  repoVariableBudget: 60,
} as const;

/** Cloudflare Stream is pay-as-you-go: nothing is included, everything is cheap. */
export const CLOUDFLARE_STREAM_PLAN = {
  label: "Cloudflare Stream (pay-as-you-go)",
  usdPerThousandMinutesStored: 5,
  usdPerThousandMinutesDelivered: 1,
  liveInputName: "westpeek-fallback",
} as const;

/**
 * Supabase Free. The cliff here is not a quota: it is the seven-day idle auto-pause, which takes
 * the runtime store down between shows and returns a dead app to whoever opens it next.
 */
export const SUPABASE_PLAN = {
  label: "Supabase Free",
  databaseMb: 500,
  egressGb: 5,
  autoPauseIdleDays: 7,
  backups: false,
} as const;

/** 0–1, or null when either side of the fraction is unknown. Never invents a comfortable bar. */
export function fractionUsed(used: number | null, included: number | null): number | null {
  if (used === null || included === null || included <= 0) return null;
  return used / included;
}
