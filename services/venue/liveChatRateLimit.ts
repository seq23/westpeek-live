import { liveChatRateKey, type LiveChatRateState } from "@/types/liveChat";

/**
 * The per-person flood guard. Always on, for everyone, independent of slow mode — slow mode is a
 * crew decision about the pace of a room, this is the floor that keeps one person (or one script
 * replaying their form) from drowning a room of five hundred.
 *
 * The numbers, and why:
 *   BURST 5 posts / 10s   — a person typing real sentences tops out around three in ten seconds;
 *                           five leaves room for short "yes"/"+1" reactions. A script clears it instantly.
 *   SUSTAINED 20 / 60s    — the same person cannot hold burst pace for a minute: twenty messages a
 *                           minute is already the loudest voice in any room.
 *   COOLDOWN 20s          — long enough to break a flood loop, short enough that an excited
 *                           attendee is back in the conversation before the topic moves on.
 *
 * Tripping either limit starts the same cooldown, and the attendee is TOLD (with the seconds left)
 * rather than having the message silently dropped.
 */
export const LIVE_CHAT_RATE_BURST = 5;
export const LIVE_CHAT_RATE_BURST_WINDOW_MS = 10_000;
export const LIVE_CHAT_RATE_SUSTAINED = 20;
export const LIVE_CHAT_RATE_SUSTAINED_WINDOW_MS = 60_000;
export const LIVE_CHAT_RATE_COOLDOWN_MS = 20_000;
/** Only the sustained window has to be counted, so the row never grows past that. */
export const LIVE_CHAT_RATE_HISTORY = LIVE_CHAT_RATE_SUSTAINED;

export type LiveChatRateDecision =
  | { ok: true; state: LiveChatRateState }
  | { ok: false; retryAfterSeconds: number; limit: "burst" | "sustained" | "cooldown"; reason: string };

function countWithin(recent: string[], nowMs: number, windowMs: number) {
  return recent.filter((iso) => nowMs - Date.parse(iso) < windowMs).length;
}

export function liveChatRateLimitedMessage(retryAfterSeconds: number) {
  return `You are sending messages too quickly. Wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} and send it again — nothing you typed was thrown away.`;
}

/**
 * Pure: given the attendee's stored rate row and the clock, either the row to store after this
 * post, or the refusal with the seconds left. Called on the WRITE path, so a bypassed UI is
 * refused exactly like a well-behaved one.
 */
export function applyLiveChatRate(input: { eventId: string; attendeeId: string; roomKey: string; state?: LiveChatRateState; now?: Date }): LiveChatRateDecision {
  const now = input.now || new Date();
  const nowMs = now.getTime();
  const recent = (input.state?.recentPostsAt || []).filter((iso) => Number.isFinite(Date.parse(iso)) && nowMs - Date.parse(iso) < LIVE_CHAT_RATE_SUSTAINED_WINDOW_MS);
  const cooldownMs = input.state?.cooldownUntil ? Date.parse(input.state.cooldownUntil) : 0;
  if (cooldownMs > nowMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - nowMs) / 1000);
    return { ok: false, retryAfterSeconds, limit: "cooldown", reason: liveChatRateLimitedMessage(retryAfterSeconds) };
  }
  const tripped = countWithin(recent, nowMs, LIVE_CHAT_RATE_BURST_WINDOW_MS) >= LIVE_CHAT_RATE_BURST ? "burst" : recent.length >= LIVE_CHAT_RATE_SUSTAINED ? "sustained" : undefined;
  const key = liveChatRateKey(input.eventId, input.attendeeId);
  if (tripped) {
    const retryAfterSeconds = Math.ceil(LIVE_CHAT_RATE_COOLDOWN_MS / 1000);
    return { ok: false, retryAfterSeconds, limit: tripped, reason: liveChatRateLimitedMessage(retryAfterSeconds) };
  }
  return {
    ok: true,
    state: {
      key,
      eventId: input.eventId,
      attendeeId: input.attendeeId,
      recentPostsAt: [now.toISOString(), ...recent].slice(0, LIVE_CHAT_RATE_HISTORY),
      lastPostAtByRoom: { ...(input.state?.lastPostAtByRoom || {}), [input.roomKey]: now.toISOString() },
      updatedAt: now.toISOString(),
    },
  };
}

/**
 * The refusal writes the cooldown back, so the next attempt is refused by the cooldown branch
 * without recounting — and so the composer can show a countdown that does not reset on retry.
 */
export function liveChatRateCooldownState(input: { eventId: string; attendeeId: string; state?: LiveChatRateState; now?: Date }): LiveChatRateState {
  const now = input.now || new Date();
  return {
    key: liveChatRateKey(input.eventId, input.attendeeId),
    eventId: input.eventId,
    attendeeId: input.attendeeId,
    recentPostsAt: input.state?.recentPostsAt || [],
    lastPostAtByRoom: input.state?.lastPostAtByRoom,
    cooldownUntil: new Date(now.getTime() + LIVE_CHAT_RATE_COOLDOWN_MS).toISOString(),
    updatedAt: now.toISOString(),
  };
}
