/**
 * WHAT THE PLANS ACTUALLY INCLUDE — one place, so nobody retypes a number into prose again.
 *
 * Ship was read off the provider dashboard on 16 Sep 2026. Build (the plan we are on since 2 Nov 2026,
 * when the project was downgraded because no event is booked before January) was read from
 * https://livekit.com/pricing.md on 2 Nov 2026. Transcode minutes are the first cliff, because every
 * minute of StreamYard feed pushed into an ingress burns one whether five people watch or five hundred.
 * On Build that cliff is a wall: 60 minutes a month and no overage billing, so one 90-minute show
 * cannot run on it — livekitPlanFit() names that before the show (LIVEKIT_PLAN_TOO_SMALL).
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
  /** False when the plan lists no overage billing: every allowance is then a hard cap, not a bill. */
  overageBilled: boolean;
  /** Where the numbers were read, and when. */
  source: string;
  /** Limits the readout does not draw as bars but an operator should know. */
  otherLimits: string[];
  /** Transcode minutes FIRST: it is the cliff we hit before any of the others. */
  allowances: Allowance[];
}

const NOT_READ = "Not read from the LiveKit dashboard — only Build and Ship were. Put the plan page's numbers here before switching LIVEKIT_TIER to it.";

function unreadAllowances(): Allowance[] {
  return [
    { key: "transcodeMinutes", label: "Transcode minutes", included: null, unit: "min", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
    { key: "participantMinutes", label: "WebRTC participant-minutes", included: null, unit: "participant-min", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
    { key: "downstreamGb", label: "Downstream bandwidth", included: null, unit: "GB", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
    { key: "concurrentConnections", label: "Concurrent connections", included: null, unit: "connections", unknownReason: NOT_READ, overage: { usdPerUnit: null, note: NOT_READ } },
  ];
}

const BUILD_SOURCE = "https://livekit.com/pricing.md, read 2 Nov 2026";
const BUILD_HARD_CAP = "Hard cap on Build: no overage billing is listed, so past this the service stops rather than bills.";

const LIVEKIT_PLANS: Record<LiveKitTier, LiveKitPlan> = {
  build: {
    tier: "build",
    label: "LiveKit Build (free)",
    monthlyUsd: 0,
    // Downstream bandwidth is not listed for Build, so not every allowance is a real reading.
    confirmed: false,
    overageBilled: false,
    source: BUILD_SOURCE,
    otherLimits: ["2 concurrent stream imports", "2 concurrent exports", "60 track-egress minutes a month"],
    allowances: [
      { key: "transcodeMinutes", label: "Transcode minutes", included: 60, unit: "min", unknownReason: "", overage: { usdPerUnit: null, note: `Shared between stream import (ingress) and recording/export. ${BUILD_HARD_CAP}` } },
      { key: "participantMinutes", label: "WebRTC participant-minutes", included: 5_000, unit: "participant-min", unknownReason: "", overage: { usdPerUnit: null, note: BUILD_HARD_CAP } },
      { key: "downstreamGb", label: "Downstream bandwidth", included: null, unit: "GB", unknownReason: `Not listed for Build on ${BUILD_SOURCE}. Check the LiveKit dashboard.`, overage: { usdPerUnit: null, note: "Not listed for Build." } },
      { key: "concurrentConnections", label: "Concurrent connections", included: 100, unit: "connections", unknownReason: "", overage: { usdPerUnit: null, note: "A ceiling: the 101st connection is refused." } },
    ],
  },
  ship: {
    tier: "ship",
    label: "LiveKit Ship",
    monthlyUsd: 50,
    confirmed: true,
    overageBilled: true,
    source: "LiveKit Cloud dashboard, read 16 Sep 2026",
    otherLimits: [],
    allowances: [
      { key: "transcodeMinutes", label: "Transcode minutes", included: 600, unit: "min", unknownReason: "", overage: { usdPerUnit: 0.02, note: "$0.02 per transcode minute (video) past 600." } },
      { key: "participantMinutes", label: "WebRTC participant-minutes", included: 150_000, unit: "participant-min", unknownReason: "", overage: { usdPerUnit: 0.0005, note: "$0.0005 per participant-minute past 150,000." } },
      { key: "downstreamGb", label: "Downstream bandwidth", included: 250, unit: "GB", unknownReason: "", overage: { usdPerUnit: 0.12, note: "$0.12 per GB past 250." } },
      { key: "concurrentConnections", label: "Concurrent connections", included: 1_000, unit: "connections", unknownReason: "", overage: { usdPerUnit: null, note: "A ceiling, not an overage: the 1,001st connection is refused." } },
    ],
  },
  scale: { tier: "scale", label: "LiveKit Scale", monthlyUsd: null, confirmed: false, overageBilled: true, source: "not read", otherLimits: [], allowances: unreadAllowances() },
};

/** The plan we are on. Defaults to Build — the owner downgraded from Ship on 2 Nov 2026. */
export function livekitTier(env: Record<string, string | undefined> = process.env): LiveKitTier {
  const raw = (env.LIVEKIT_TIER || "").trim().toLowerCase();
  return (LIVEKIT_TIERS as readonly string[]).includes(raw) ? (raw as LiveKitTier) : "build";
}

export function livekitPlan(tier: LiveKitTier = livekitTier()): LiveKitPlan {
  return LIVEKIT_PLANS[tier];
}

export function livekitAllowance(key: AllowanceKey, tier: LiveKitTier = livekitTier()): Allowance {
  return livekitPlan(tier).allowances.find((allowance) => allowance.key === key)!;
}

export const LIVEKIT_PLAN_TOO_SMALL = "LIVEKIT_PLAN_TOO_SMALL" as const;
export const LIVEKIT_DASHBOARD_URL = "https://cloud.livekit.io";

export interface LiveKitPlanTooSmall {
  code: typeof LIVEKIT_PLAN_TOO_SMALL;
  /** "Switch LiveKit to Ship ($50/mo) before this event" */
  message: string;
  dashboardUrl: string;
  /** Each allowance the event would pass, in words. Never empty. */
  reasons: string[];
}

/**
 * Will this event fit the plan we are on? Only a plan with no overage billing can refuse a show, so
 * only that plan (Build) can return LIVEKIT_PLAN_TOO_SMALL; on Ship the same show is a bill.
 *
 * Month-to-date transcode use is dashboard-only (see capacityReadingService), so the run time is
 * measured against the WHOLE monthly allowance — the best case. Anything that fails the best case
 * fails for certain.
 */
export function livekitPlanFit(input: { tier: LiveKitTier; runMinutes: number; expectedAudience: number }): LiveKitPlanTooSmall | null {
  const plan = livekitPlan(input.tier);
  if (plan.overageBilled) return null;
  const transcode = livekitAllowance("transcodeMinutes", input.tier).included;
  const concurrent = livekitAllowance("concurrentConnections", input.tier).included;
  const participant = livekitAllowance("participantMinutes", input.tier).included;
  const runMinutes = Math.max(0, Math.round(input.runMinutes));
  const audience = Math.max(0, Math.round(input.expectedAudience));
  const reasons: string[] = [];
  if (transcode !== null && runMinutes > transcode) reasons.push(`A ${runMinutes}-minute show needs ${runMinutes} transcode minutes; ${plan.label} has ${transcode} a month in total, shared with recording.`);
  if (concurrent !== null && audience > concurrent) reasons.push(`${audience} expected attendees; ${plan.label} refuses connection ${concurrent + 1}.`);
  if (participant !== null && audience * runMinutes > participant) reasons.push(`${audience} attendees for ${runMinutes} minutes is ${audience * runMinutes} participant-minutes; ${plan.label} has ${participant} a month.`);
  if (!reasons.length) return null;
  const ship = livekitPlan("ship");
  return { code: LIVEKIT_PLAN_TOO_SMALL, message: `Switch LiveKit to Ship ($${ship.monthlyUsd}/mo) before this event`, dashboardUrl: LIVEKIT_DASHBOARD_URL, reasons };
}

// ---------------------------------------------------------------------------
// THE PLANS EACH SHOW-DAY SERVICE IS ON, and whether a given event fits them.
// LiveKit's tier is a setting (Settings → house defaults, or LIVEKIT_TIER). The other three have no
// API that reports a plan, so the owner's answer is recorded here (2 Nov 2026: all free). After an
// upgrade, change the one value below; `null` means nobody recorded it and the check says so.
// ---------------------------------------------------------------------------

export type ZoomPlan = "basic" | "pro";
export type ResendPlan = "free" | "pro";
export type StreamyardPlan = "free" | "essential" | "core" | "advanced";

export interface RecordedPlans {
  livekit: LiveKitTier;
  zoom: ZoomPlan | null;
  resend: ResendPlan | null;
  streamyard: StreamyardPlan | null;
}

/** The owner's answer on 2 Nov 2026. Read by the plan check and by the /app/capacity rows. */
export const RECORDED_SERVICE_PLANS: Omit<RecordedPlans, "livekit"> = { zoom: "basic", resend: "free", streamyard: "free" };

const ZOOM_MEETING_MINUTES: Record<ZoomPlan, number> = { basic: 40, pro: 30 * 60 };
const RESEND_EMAILS_PER_DAY: Record<ResendPlan, number | null> = { free: 100, pro: null };
const PLAN_LABEL = {
  zoom: { basic: "Zoom Basic (free)", pro: "Zoom Pro" },
  resend: { free: "Resend Free", pro: "Resend Pro" },
  streamyard: { free: "StreamYard Free", essential: "StreamYard Essential", core: "StreamYard Core", advanced: "StreamYard Advanced" },
} as const;

export type PlanService = "LiveKit" | "Zoom" | "Resend" | "StreamYard";

export interface PlanShortfall {
  service: PlanService;
  /** The plan we are on, or "plan not recorded". */
  current: string;
  /** "Ship", "Pro", "a paid plan". */
  upgradeTo: string;
  planRecorded: boolean;
  /** Why it falls short, in words. Never empty. */
  reasons: string[];
}

export interface PlanFitShow {
  runMinutes: number;
  /** People registered for it. */
  audience: number;
  /** A Room is LiveKit WebRTC only; StreamYard feeds the stage, so only a stage show needs it. */
  format?: "stage" | "room";
}

function notRecorded(service: PlanService, upgradeTo: string): PlanShortfall {
  return { service, current: "plan not recorded", upgradeTo, planRecorded: false, reasons: [`The ${service} plan is not recorded, so nobody can say it carries this show.`] };
}

/**
 * THE ONE PLAN CHECK. Every service whose recorded plan cannot carry this show, in the order the
 * banner names them. Empty when everything fits. Figures are the ones serviceCapacityRows() shows.
 *
 * Zoom and Google Meet are fallback rungs capped at 100 participants on every plan we would buy, so
 * the participant cap is shown on /app/capacity but is not an upgrade trigger; Zoom Basic's
 * 40-minute meeting is, because Pro removes it. Google Meet is a static link: not checked.
 */
export function eventPlanShortfalls(show: PlanFitShow, plans: RecordedPlans): PlanShortfall[] {
  const runMinutes = Math.max(0, Math.round(show.runMinutes));
  const audience = Math.max(0, Math.round(show.audience));
  const out: PlanShortfall[] = [];

  const livekit = livekitPlanFit({ tier: plans.livekit, runMinutes, expectedAudience: audience });
  if (livekit) out.push({ service: "LiveKit", current: livekitPlan(plans.livekit).label, upgradeTo: "Ship", planRecorded: true, reasons: livekit.reasons });

  if (plans.zoom === null) out.push(notRecorded("Zoom", "Pro"));
  else if (runMinutes > ZOOM_MEETING_MINUTES[plans.zoom]) out.push({ service: "Zoom", current: PLAN_LABEL.zoom[plans.zoom], upgradeTo: "Pro", planRecorded: true, reasons: [`A ${runMinutes}-minute show; a ${PLAN_LABEL.zoom[plans.zoom]} meeting ends at ${ZOOM_MEETING_MINUTES[plans.zoom]} minutes.`] });

  if (plans.resend === null) out.push(notRecorded("Resend", "Pro"));
  else {
    const perDay = RESEND_EMAILS_PER_DAY[plans.resend];
    if (perDay !== null && audience > perDay) out.push({ service: "Resend", current: PLAN_LABEL.resend[plans.resend], upgradeTo: "Pro", planRecorded: true, reasons: [`A show-day reminder to ${audience} registered people; ${PLAN_LABEL.resend[plans.resend]} sends ${perDay} emails a day.`] });
  }

  if (show.format !== "room") {
    if (plans.streamyard === null) out.push(notRecorded("StreamYard", "a paid plan"));
    else if (plans.streamyard === "free") out.push({ service: "StreamYard", current: PLAN_LABEL.streamyard.free, upgradeTo: "a paid plan", planRecorded: true, reasons: ["StreamYard Free puts its branding on the stage and has streaming limits its pricing page does not state; a real show needs Essential or Core."] });
  }
  return out;
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
 * Cloudflare D1 and R2, inside the Workers Paid plan already paid for (since 16 Sep 2026). There is
 * no idle pause and no new subscription: the cliffs are the included monthly allowances.
 */
export const D1_PLAN = {
  label: "Cloudflare D1 (Workers Paid)",
  databaseGb: 5,
  rowsReadPerMonth: 25_000_000_000,
  rowsWrittenPerMonth: 50_000_000,
  idlePause: false,
} as const;

export const R2_PLAN = {
  label: "Cloudflare R2 (Workers Paid)",
  storageGbMonth: 10,
  classAOpsPerMonth: 1_000_000,
  classBOpsPerMonth: 10_000_000,
  egressFees: false,
} as const;

/** 0–1, or null when either side of the fraction is unknown. Never invents a comfortable bar. */
export function fractionUsed(used: number | null, included: number | null): number | null {
  if (used === null || included === null || included <= 0) return null;
  return used / included;
}

// ---------------------------------------------------------------------------
// EVERY SERVICE westpeek.live uses — one row each, matching the service table in
// docs/SETUP_AND_ACCOUNTS.md (tests/unit/capacityAndKeepAlive.test.ts holds the two lists equal).
// Every figure was read from the provider's own pricing page or account on the date given. A plan
// we could not read is `planRecorded: false` and printed as "plan not recorded"; a figure we could
// not read is null and printed "unknown". Nothing here is a guess.
// ---------------------------------------------------------------------------

/** The show every row is measured against until a real one is booked. */
export const REFERENCE_SHOW = { runMinutes: 90, audience: 200 } as const;

export interface ServiceCapacity {
  /** Exactly the first column of the SETUP_AND_ACCOUNTS.md service table, up to any " (". */
  service: string;
  role: string;
  plan: string;
  planRecorded: boolean;
  /** "$0", "$5/mo", "pay-as-you-go", or "unknown". */
  cost: string;
  included: string;
  /** The limit the reference show reaches first, in words. */
  firstLimit: string;
  /** Share of that limit the reference show uses (1 = at it). null = cannot be worked out. */
  showLoad: number | null;
  /** "hard wall", or the price past the allowance. */
  pastIt: string;
  source: string;
}

const READ = "read 2 Nov 2026";

/** Downstream for one viewer of a 1.5 Mbps stream, per minute, in GB (docs/CAPACITY.md worked example). */
const GB_PER_VIEWER_MINUTE = (1.5e6 / 8) * 60 / 1e9;

function livekitRow(tier: LiveKitTier, show: { runMinutes: number; audience: number }): ServiceCapacity {
  const plan = livekitPlan(tier);
  const demand: Record<AllowanceKey, number> = {
    transcodeMinutes: show.runMinutes,
    participantMinutes: show.audience * show.runMinutes,
    downstreamGb: Math.round(show.audience * show.runMinutes * GB_PER_VIEWER_MINUTE),
    concurrentConnections: show.audience,
  };
  const loads = plan.allowances
    .filter((allowance) => allowance.included !== null)
    .map((allowance) => ({ allowance, load: demand[allowance.key] / (allowance.included as number) }))
    .sort((a, b) => b.load - a.load);
  const worst = loads[0];
  const included = plan.allowances.map((a) => `${a.included === null ? "unknown" : a.included.toLocaleString("en-US")} ${a.label.toLowerCase()}`).join(" · ");
  return {
    service: "LiveKit Cloud",
    role: "Main stage, rooms, RTMP ingress from StreamYard",
    plan: plan.label,
    planRecorded: true,
    cost: plan.monthlyUsd === null ? "unknown" : plan.monthlyUsd === 0 ? "$0" : `$${plan.monthlyUsd}/mo`,
    included,
    firstLimit: worst ? `${worst.allowance.label}: ${demand[worst.allowance.key].toLocaleString("en-US")} of ${(worst.allowance.included as number).toLocaleString("en-US")}` : "unknown",
    showLoad: worst ? worst.load : null,
    pastIt: plan.overageBilled ? (worst?.allowance.overage.note || "billed") : "hard wall (no overage billing)",
    source: plan.source,
  };
}

export function serviceCapacityRows(tier: LiveKitTier = livekitTier(), show: { runMinutes: number; audience: number } = REFERENCE_SHOW): ServiceCapacity[] {
  const participantMinutes = show.audience * show.runMinutes;
  // A guest polls chat every 4 s (docs/CAPACITY.md): 15 requests a minute each.
  const workerRequests = show.audience * show.runMinutes * 15;
  return [
    {
      service: "GitHub", role: "Source, CI, deploy trigger", plan: "Free (public repo)", planRecorded: true, cost: "$0",
      included: "Standard GitHub-hosted runner minutes are free for public repositories",
      firstLimit: "None on show day: a show runs no CI", showLoad: 0, pastIt: "nothing to pay while the repo stays public",
      source: `https://docs.github.com/en/billing/concepts/product-billing/github-actions (${READ}); repo visibility PUBLIC via gh (${READ})`,
    },
    {
      service: "Cloudflare Workers", role: "Hosts the app", plan: "Workers Paid", planRecorded: true, cost: `$${CLOUDFLARE_WORKERS_PLAN.monthlyUsd}/mo`,
      included: "10 million requests · 30 million CPU-ms a month · 128 variables per Worker",
      firstLimit: `Requests: about ${workerRequests.toLocaleString("en-US")} of 10,000,000`, showLoad: workerRequests / CLOUDFLARE_WORKERS_PLAN.includedRequests,
      pastIt: "$0.30 per extra million requests · $0.02 per extra million CPU-ms",
      source: `https://developers.cloudflare.com/workers/platform/pricing/ (${READ})`,
    },
    {
      service: "Cloudflare D1", role: "The database", plan: "Inside Workers Paid", planRecorded: true, cost: "$0 extra",
      included: "25 billion rows read · 50 million rows written · 5 GB a month",
      firstLimit: "Rows written: under 0.5% (a 500-person, 3-hour show is 0.5%)", showLoad: 0.005,
      pastIt: "$1.00 per extra million rows written · $0.001 per million read · $0.75 per GB-month",
      source: `https://developers.cloudflare.com/workers/platform/pricing/ (${READ})`,
    },
    {
      service: "Cloudflare R2", role: "Uploaded files", plan: "Inside Workers Paid (R2 free tier)", planRecorded: true, cost: "$0 extra",
      included: "10 GB-month · 1 million Class A · 10 million Class B operations · free egress",
      firstLimit: "Storage: a show adds a few decks and logos, well under 1%", showLoad: 0.01,
      pastIt: "$0.015 per GB-month · $4.50 per million Class A · $0.36 per million Class B",
      source: `https://developers.cloudflare.com/r2/pricing/ (${READ})`,
    },
    {
      service: "Cloudflare DNS", role: "westpeek.live zone and inbound Email Routing", plan: "Free Website (zone plan)", planRecorded: true, cost: "$0",
      included: "DNS included; Email Routing: 200 rules per domain · 200 destination addresses · 25 MiB per message",
      firstLimit: "None on show day; DNS query metering is not stated (unknown)", showLoad: 0,
      pastIt: "hard wall on the Email Routing limits (a larger message is rejected)",
      source: `zone plan via Cloudflare API (${READ}); https://developers.cloudflare.com/email-routing/limits/ (${READ})`,
    },
    {
      service: "Cloudflare Stream Live", role: "Fallback rung 2", plan: "Pay-as-you-go", planRecorded: true, cost: "pay-as-you-go",
      included: "Nothing included; live ingest and encoding are free",
      firstLimit: `Prepaid storage: when it runs out no new live stream can start. Amount bought: unknown. Delivery if the whole show falls back: ${participantMinutes.toLocaleString("en-US")} minutes ≈ $${Math.round(participantMinutes / 1000 * CLOUDFLARE_STREAM_PLAN.usdPerThousandMinutesDelivered)}`,
      showLoad: null, pastIt: "$5 per 1,000 minutes stored (prepaid) · $1 per 1,000 minutes delivered",
      source: `https://developers.cloudflare.com/stream/pricing/ (${READ})`,
    },
    livekitRow(tier, show),
    {
      service: "StreamYard", role: "Production switcher, sends RTMP into LiveKit", plan: RECORDED_SERVICE_PLANS.streamyard ? `${PLAN_LABEL.streamyard[RECORDED_SERVICE_PLANS.streamyard]} (owner, 2 Nov 2026)` : "plan not recorded", planRecorded: RECORDED_SERVICE_PLANS.streamyard !== null, cost: "$0",
      included: "By plan: Free 6 on-screen · Essential $18.99/mo 2 destinations, 1080p · Core $44.99/mo 3 destinations, 10 on-screen · Advanced $88.99/mo 8 destinations, 10 on-screen + 15 backstage",
      firstLimit: "Free: 6 on-screen, StreamYard branding, and \"streaming limits\" the pricing page does not quantify; upgrade to Essential or Core before a real show", showLoad: null,
      pastIt: "hard wall (a plan feature, not a meter)",
      source: `https://streamyard.com/pricing (${READ}); no API, so the plan cannot be read`,
    },
    {
      service: "Daily", role: "Fallback rung 3", plan: "Pay-as-you-go (domain westpeeklive; the API does not expose a plan name)", planRecorded: true, cost: "pay-as-you-go",
      included: "10,000 participant-minutes a month free",
      firstLimit: `Participant-minutes if the whole show falls back: ${participantMinutes.toLocaleString("en-US")} of 10,000`, showLoad: participantMinutes / 10_000,
      pastIt: `$0.004 per participant-minute (≈ $${Math.round(Math.max(0, participantMinutes - 10_000) * 0.004)} for this show) — a bill, not a wall`,
      source: `https://www.daily.co/pricing/video-sdk/ (${READ}); domain config via Daily API (${READ})`,
    },
    {
      service: "Zoom Meeting SDK", role: "Fallback rung 4", plan: RECORDED_SERVICE_PLANS.zoom ? `${PLAN_LABEL.zoom[RECORDED_SERVICE_PLANS.zoom]} (owner, 2 Nov 2026; the SDK follows the host's Zoom licence)` : "plan not recorded", planRecorded: RECORDED_SERVICE_PLANS.zoom !== null, cost: "$0",
      included: "Basic: 100 participants, 40 minutes · Pro $16.99/mo: 100 participants, 30 hours",
      firstLimit: `Participants: ${show.audience} of 100, and a Basic meeting ends at 40 minutes`, showLoad: Math.max(show.audience / 100, show.runMinutes / 40),
      pastIt: "hard wall",
      source: `https://zoom.us/pricing and https://developers.zoom.us/docs/meeting-sdk/ (${READ})`,
    },
    {
      service: "Google Meet", role: "Fallback rung 5, a static link", plan: "plan not recorded", planRecorded: false, cost: "unknown",
      included: "Personal account: 100 participants, group calls 60 minutes · Business Starter 100 · Business Standard 150",
      firstLimit: `Participants: ${show.audience} of 100 on a personal account (150 on Business Standard); group calls end at 60 minutes on a personal account`, showLoad: show.audience / 100,
      pastIt: "hard wall",
      source: `https://support.google.com/meet/answer/7317473 (${READ})`,
    },
    {
      service: "Resend", role: "All outgoing email", plan: RECORDED_SERVICE_PLANS.resend ? `${PLAN_LABEL.resend[RECORDED_SERVICE_PLANS.resend]} (owner, 2 Nov 2026)` : "plan not recorded", planRecorded: RECORDED_SERVICE_PLANS.resend !== null, cost: "$0",
      included: "Free: 3,000 a month, 100 a day · Pro $20/mo: 50,000 a month, no daily limit",
      firstLimit: `Emails a day: a show-day reminder to ${show.audience} people against 100 a day`, showLoad: show.audience / 100,
      pastIt: "Free: hard wall · Pro: $0.90 per extra 1,000",
      source: `https://resend.com/pricing (${READ})`,
    },
  ];
}

/** Worst first: anything over its limit, then anything we cannot measure, then by how close it gets. */
export function serviceCapacityWorstFirst(rows: ServiceCapacity[]): ServiceCapacity[] {
  const rank = (row: ServiceCapacity) => (row.showLoad !== null && row.showLoad >= 1 ? 2 + row.showLoad : row.showLoad === null || !row.planRecorded ? 1.5 : row.showLoad);
  return [...rows].sort((a, b) => rank(b) - rank(a));
}
