/**
 * The health signal, as pure data. One dot on the Event Command Bar answers "is anything breaking
 * right now" without opening anything (plan §2.3).
 *
 * The rule that keeps it honest: a probe that DID NOT RUN reads grey/unknown, never green. A dot
 * derived from an assumption is worse than no dot — it tells a producer the feed is fine while
 * nothing is publishing. So every signal carries the source it was read from and when, and a
 * signal with no `checkedAt` is forced to unknown here rather than trusted from the caller.
 */

export type HealthLevel = "green" | "yellow" | "red" | "unknown";

/** What to do about a yellow or red signal, rendered as a real control in the panel — not prose. */
export interface HealthAction {
  label: string;
  /** The panel knows how to render these inline; a href is a last resort (another page). */
  kind: "get-credentials" | "go-live" | "open-stage-requests" | "crew-deck" | "fallback" | "manual";
  href?: string;
}

export interface HealthSignal {
  key: HealthSignalKey;
  label: string;
  level: HealthLevel;
  /** One sentence in the producer's words: what is true right now. */
  detail: string;
  /** Where the answer came from. Never "we assume"; a named probe, table or API. */
  source: string;
  /** ISO instant the probe ran. Absent → the probe did not run → unknown. */
  checkedAt?: string;
  action?: HealthAction;
}

export type HealthSignalKey =
  | "feed" | "stage" | "webhook" | "fallback" | "database" | "chat" | "attendees" | "build" | "capacity";

/** The order the panel lists them in — worst first would hide the shape of the show; this is the pipeline order. */
export const HEALTH_SIGNAL_ORDER: readonly HealthSignalKey[] = ["feed", "stage", "webhook", "fallback", "database", "chat", "attendees", "build", "capacity"] as const;

export const HEALTH_SIGNAL_LABELS: Record<HealthSignalKey, string> = {
  feed: "Feed",
  stage: "Stage",
  webhook: "Webhook",
  fallback: "Fallback",
  database: "Database",
  chat: "Chat",
  attendees: "Attendees",
  build: "Build",
  capacity: "Capacity",
};

/**
 * Worst wins, and grey beats green. red > yellow > unknown > green means the dot can only read
 * green when EVERY signal was actually measured and every measurement was good.
 */
const RANK: Record<HealthLevel, number> = { red: 3, yellow: 2, unknown: 1, green: 0 };

export function worstLevel(signals: readonly HealthSignal[]): HealthLevel {
  if (!signals.length) return "unknown";
  return signals.reduce<HealthLevel>((worst, signal) => (RANK[signal.level] > RANK[worst] ? signal.level : worst), "green");
}

/** A signal with no `checkedAt` never reports green or yellow: the probe did not run, so we do not know. */
export function settle(signal: HealthSignal): HealthSignal {
  if (signal.checkedAt) return signal;
  return { ...signal, level: "unknown" };
}

export function settleAll(signals: readonly HealthSignal[]): HealthSignal[] {
  return signals.map(settle);
}

/** The one-line summary next to the dot. Names the count, so a grey dot is not mistaken for "fine". */
export function healthSummary(signals: readonly HealthSignal[]): string {
  const level = worstLevel(signals);
  const red = signals.filter((s) => s.level === "red");
  const yellow = signals.filter((s) => s.level === "yellow");
  const grey = signals.filter((s) => s.level === "unknown");
  if (level === "red") return `${red.length} failing: ${red.map((s) => s.label.toLowerCase()).join(", ")}.`;
  if (level === "yellow") return `${yellow.length} needing a look: ${yellow.map((s) => s.label.toLowerCase()).join(", ")}.`;
  if (level === "unknown") return `${grey.length} not measured on this deployment: ${grey.map((s) => s.label.toLowerCase()).join(", ")}.`;
  return "Everything measured is healthy.";
}

export const HEALTH_DOT_CLASS: Record<HealthLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-600",
  unknown: "bg-slate-400",
};

export const HEALTH_LEVEL_WORD: Record<HealthLevel, string> = {
  green: "Healthy",
  yellow: "Needs a look",
  red: "Failing",
  unknown: "Not measured",
};

/** What the per-show log rows look like on the wire. Times stay ISO; the viewer's clock formats them. */
export interface HealthLogEntry {
  id: string;
  at: string;
  /** "Went live", "Feed dropped", "Moved to Cloudflare Stream", "Show ended". */
  headline: string;
  detail: string;
}

/** The stage-stream signals that are worth a line in the per-show log, in the producer's words. */
const LOG_HEADLINES: Record<string, string> = {
  generate_credentials: "Stream credentials minted",
  ingress_started: "Went live — the feed started publishing",
  ingress_ended: "Feed stopped publishing",
  livekit_room_unreachable: "LiveKit room unreachable",
  livekit_token_failure: "LiveKit refused a token",
  attendee_livekit_disconnect_after_started: "An attendee dropped off the stage",
  manual_switch_to_cloudflare_stream: "Moved to Cloudflare Stream",
  cloudflare_stream_live: "Cloudflare Stream is carrying the room",
  cloudflare_stream_failed: "Cloudflare Stream failed",
  manual_switch_to_daily: "Moved to Daily",
  daily_failed: "Daily failed",
  move_production_to_daily: "Production moved to Daily",
  manual_switch_to_zoom: "Moved to Zoom",
  zoom_failed: "Zoom failed",
  manual_switch_to_google_meet: "Moved to Google Meet",
  operator_mark_show_ended: "Show ended",
  operator_reset_primary: "Primary reset",
  operator_rollback_to_livekit: "Moved back up to LiveKit",
  operator_rollback_to_cloudflare_stream: "Moved back to Cloudflare Stream",
  operator_rollback_to_daily: "Moved back to Daily",
};

export function logHeadline(signal: string) {
  return LOG_HEADLINES[signal] || signal.replaceAll("_", " ");
}
