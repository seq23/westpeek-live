import { headers } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * The public origin of this deployment. NEXT_PUBLIC_APP_URL defaults to http://localhost:3000 and on
 * 15 Sep 2026 that is exactly what the lobby handed the owner to send out. The request's own host is
 * the truth; the configured value is used only when it is a real public origin; the production domain
 * is the last resort. Shared by the join link and the LiveKit webhook URL shown to the operator.
 */
export async function appBaseUrl() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
      const proto = h.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`;
    }
  } catch {
    // no request scope (tests, build): fall through
  }
  try {
    const configured = getEnv().NEXT_PUBLIC_APP_URL;
    if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured.replace(/\/$/, "");
  } catch {
    // fall through
  }
  return "https://westpeek.live";
}

export const LIVEKIT_WEBHOOK_PATH = "/api/video/livekit-webhook";

export async function livekitWebhookUrl() {
  return `${await appBaseUrl()}${LIVEKIT_WEBHOOK_PATH}`;
}
