import { createHash } from "node:crypto";
import { test as base } from "@playwright/test";

export * from "@playwright/test";

/**
 * Every test reaches the app from its own address.
 *
 * The gates count tries per address (services/access/gateAttemptLimiter.ts: 6 a minute per event,
 * 20 a minute per gate). In production Cloudflare sets `cf-connecting-ip`; under `next start` the
 * whole suite comes from 127.0.0.1, so a few dozen honest sign-ins in a minute read as a prober and
 * every later test is refused with `too_many`. Here each test (and each retry) sends a stable,
 * distinct private 10.x address instead, so a test sees exactly the limits one real visitor would. A test
 * that probes the limit itself still shares one address across its own attempts.
 */
export function testAddressFor(key: string) {
  const digest = createHash("sha256").update(key).digest();
  // 10.0.0.0/8, private and never a real visitor; three bytes from the test's identity.
  return `10.${digest[0]}.${digest[1]}.${digest[2]}`;
}

function isLocal(baseURL: string | undefined) {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(baseURL || "").hostname);
  } catch {
    return false;
  }
}

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders, baseURL }, use, testInfo) => {
    // A deployed run goes through Cloudflare, which overwrites cf-connecting-ip with the real
    // address, so the header is only sent to the local server.
    if (!isLocal(baseURL)) return use(extraHTTPHeaders);
    const address = testAddressFor(`${testInfo.project.name}:${testInfo.testId}:${testInfo.retry}`);
    await use({ ...extraHTTPHeaders, "cf-connecting-ip": address });
  },
});
