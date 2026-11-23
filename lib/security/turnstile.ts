/**
 * Cloudflare Turnstile, the bot check on the public forms. The widget puts a token in the form as
 * `cf-turnstile-response`; the server asks siteverify whether that token is real.
 *
 * Three answers, never two:
 * - passed     siteverify vouched for the token, for this form's action.
 * - refused    a token came back and siteverify said it is not real (forged, replayed, another
 *              form's, malformed). Nothing is sent.
 * - unchecked  nobody could vouch either way: no token came back (an ad blocker or a privacy
 *              browser ate the widget), the secret is not set, or siteverify did not answer.
 *              The caller decides what that is worth; on /request-event it is a real person
 *              under a much tighter cap (her West Peek lead-form ruling: never refuse a real
 *              person for an ad blocker), never "passed".
 *
 * The keys: TURNSTILE_SITE_KEY (public, rendered into the page) and TURNSTILE_SECRET_KEY (Worker
 * secret), from the `westpeek-live-forms` widget (westpeek.live and www only). Workers Builds
 * previews share production's secrets and D1, so they carry the real keys; on a workers.dev host the
 * widget cannot issue a token and a preview submission takes the unchecked lane. Cloudflare's
 * always-pass test keys never go on the Worker; only the e2e suite (`next start` in CI) uses them.
 */

export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Turnstile tokens are at most 2048 characters; anything longer is not one. */
const MAX_TOKEN_LENGTH = 2048;
/** Codes that mean OUR side is wrong (key unset or rejected) or Turnstile failed, not the visitor's token. */
const NOT_THE_VISITORS_FAULT = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"]);

export type TurnstileVerdict =
  | { outcome: "passed" }
  | { outcome: "refused"; reason: string }
  | { outcome: "unchecked"; reason: string };

export function turnstileSiteKey() {
  return (process.env.TURNSTILE_SITE_KEY || "").trim();
}

export async function verifyTurnstile(input: {
  token: string;
  /** The form this token must have been issued for (the widget's data-action). */
  action: string;
  ip?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TurnstileVerdict> {
  const token = input.token.trim();
  if (!token) return { outcome: "unchecked", reason: "no_token" };
  if (token.length > MAX_TOKEN_LENGTH) return { outcome: "refused", reason: "malformed_token" };

  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set; every submission is treated as unchecked.");
    return { outcome: "unchecked", reason: "not_configured" };
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (input.ip) body.set("remoteip", input.ip);

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(input.timeoutMs ?? 5000) });
  } catch (error) {
    console.error("[turnstile] siteverify unreachable:", error instanceof Error ? error.message : error);
    return { outcome: "unchecked", reason: "siteverify_unreachable" };
  }
  if (!response.ok) {
    console.error(`[turnstile] siteverify answered HTTP ${response.status}`);
    return { outcome: "unchecked", reason: `siteverify_http_${response.status}` };
  }

  let result: { success?: unknown; action?: unknown; "error-codes"?: unknown };
  try {
    result = await response.json();
  } catch {
    return { outcome: "unchecked", reason: "siteverify_unreadable" };
  }

  if (result.success === true) {
    // The test keys report action "test"; a real widget reports the data-action it was rendered with.
    if (result.action !== input.action && result.action !== "test") return { outcome: "refused", reason: "wrong_action" };
    return { outcome: "passed" };
  }
  const codes = Array.isArray(result["error-codes"]) ? result["error-codes"].map(String) : [];
  if (codes.length > 0 && codes.every((code) => NOT_THE_VISITORS_FAULT.has(code))) {
    console.error(`[turnstile] siteverify could not judge the token: ${codes.join(", ")}`);
    return { outcome: "unchecked", reason: `siteverify_${codes.join("_")}` };
  }
  return { outcome: "refused", reason: codes.join(",") || "not_success" };
}
