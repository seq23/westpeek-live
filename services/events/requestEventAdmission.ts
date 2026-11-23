import { takeGateAttempt } from "@/services/access/gateAttemptLimiter";
import { countEventRequestsSince } from "@/services/event-intake/eventRequestPipeline";
import { sha256Hex } from "@/lib/security/portableCrypto";
import { verifyTurnstile } from "@/lib/security/turnstile";
import type { EventRequestBotCheck } from "@/types/eventRequest";

/**
 * Whether one /request-event submission may reach the owner's inbox and workspace at all.
 *
 * Each accepted request sends the owner an email and makes a draft event, so a stranger with a
 * script could fill both (an outside scan, 23 Nov 2026). In order, before anything is written:
 * 1. a burst count per address (the gate limiter, GATE_LIMITER: a few a minute), fail closed;
 * 2. the bot check: a token siteverify says is fake is refused outright; no token, or a check that
 *    could not run, is a real person with an ad blocker until shown otherwise, so it is let in under
 *    its own much tighter caps rather than refused (her West Peek lead-form ruling);
 * 3. the day's caps, counted from the request rows themselves (UTC day): per address, and for the
 *    whole site. A count that cannot be read refuses.
 */

/** Per UTC day. A busy real day for West Peek is a handful of requests; these sit well above that. */
export const REQUEST_EVENT_DAILY_CAPS = {
  /** Every request, checked or not, from everyone. */
  site: 25,
  /** From one address, when Turnstile vouched for it. */
  perAddress: 5,
  /** Unchecked requests from everyone: what a script that skips the widget can ever cost in a day. */
  siteUnchecked: 5,
  /** Unchecked requests from one address. Two lets a real person send a correction. */
  perAddressUnchecked: 2,
} as const;

/** Each refusal is a query value on /request-event, which says what happened and what to do instead. */
export type RequestEventRefusal = "check" | "busy" | "paused";

export type RequestEventAdmission =
  | { admitted: true; botCheck: EventRequestBotCheck; requesterIpHash?: string }
  | { admitted: false; status: RequestEventRefusal; reason: string };

export function utcDayStart(now: Date) {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export async function admitEventRequest(input: { ip?: string; turnstileToken: string; now?: Date }): Promise<RequestEventAdmission> {
  const gate = await takeGateAttempt({ gate: "request_event", scope: "request_event", ip: input.ip });
  if (!gate.allowed) return { admitted: false, status: gate.reason === "too_many" ? "busy" : "paused", reason: `gate_${gate.reason}` };

  const verdict = await verifyTurnstile({ token: input.turnstileToken, action: "request_event", ip: input.ip });
  if (verdict.outcome === "refused") return { admitted: false, status: "check", reason: `turnstile_${verdict.reason}` };
  const botCheck: EventRequestBotCheck = verdict.outcome === "passed" ? "passed" : "unchecked";

  const since = utcDayStart(input.now ?? new Date());
  const requesterIpHash = input.ip ? await sha256Hex(input.ip) : undefined;
  try {
    const counts = await Promise.all([
      countEventRequestsSince({ since }),
      // No address at all (a header Cloudflare always sets went missing) is counted as one sender.
      countEventRequestsSince({ since, requesterIpHash: requesterIpHash ?? "no-address" }),
      botCheck === "unchecked" ? countEventRequestsSince({ since, botCheck: "unchecked" }) : Promise.resolve(0),
      botCheck === "unchecked" ? countEventRequestsSince({ since, requesterIpHash: requesterIpHash ?? "no-address", botCheck: "unchecked" }) : Promise.resolve(0),
    ]);
    const [site, fromAddress, siteUnchecked, fromAddressUnchecked] = counts;
    if (site >= REQUEST_EVENT_DAILY_CAPS.site) return { admitted: false, status: "busy", reason: "site_daily_cap" };
    if (fromAddress >= REQUEST_EVENT_DAILY_CAPS.perAddress) return { admitted: false, status: "busy", reason: "address_daily_cap" };
    if (botCheck === "unchecked") {
      if (siteUnchecked >= REQUEST_EVENT_DAILY_CAPS.siteUnchecked) return { admitted: false, status: "busy", reason: "site_unchecked_daily_cap" };
      if (fromAddressUnchecked >= REQUEST_EVENT_DAILY_CAPS.perAddressUnchecked) return { admitted: false, status: "busy", reason: "address_unchecked_daily_cap" };
    }
  } catch (error) {
    console.error("[request-event] daily caps could not be counted, refusing:", error instanceof Error ? error.message : error);
    return { admitted: false, status: "paused", reason: "cap_count_unavailable" };
  }
  return { admitted: true, botCheck, requesterIpHash: requesterIpHash ?? "no-address" };
}
