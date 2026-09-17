import { describe, expect, it, vi } from "vitest";
import {
  BRAND_FROM_EMAIL,
  BRAND_SENDING_DOMAIN,
  emailAddressOf,
  isBrandSendingIdentity,
  resolveSendingIdentity,
} from "@/lib/brand";

/**
 * The sender identity. The point of these is that the from address is decided by the code, not by
 * a Cloudflare secret nobody can read back and not by a row an operator may have saved months ago.
 */
describe("resolveSendingIdentity", () => {
  it("keeps the brand address", () => {
    expect(resolveSendingIdentity(BRAND_FROM_EMAIL)).toBe(BRAND_FROM_EMAIL);
  });

  it("keeps any other address on the verified sending domain", () => {
    expect(resolveSendingIdentity(`tickets@${BRAND_SENDING_DOMAIN}`)).toBe(`tickets@${BRAND_SENDING_DOMAIN}`);
  });

  it("keeps a display-name identity on the sending domain", () => {
    const identity = `West Peek Live <notifications@${BRAND_SENDING_DOMAIN}>`;
    expect(resolveSendingIdentity(identity)).toBe(identity);
  });

  // The apex carries Cloudflare Email Routing for RECEIVING. It has no Resend DKIM key, so Resend
  // rejects a send claiming it. This is the case the old code would have honoured.
  it("refuses the apex domain, which has no DKIM key", () => {
    expect(resolveSendingIdentity("hello@westpeek.live")).toBe(BRAND_FROM_EMAIL);
    expect(resolveSendingIdentity("West Peek Live <hello@westpeek.live>")).toBe(BRAND_FROM_EMAIL);
    expect(resolveSendingIdentity("support@westpeek.live")).toBe(BRAND_FROM_EMAIL);
  });

  it("refuses an unrelated domain", () => {
    expect(resolveSendingIdentity("noreply@gmail.com")).toBe(BRAND_FROM_EMAIL);
  });

  // A lookalike registered by someone else must not pass a naive endsWith.
  it("refuses a lookalike domain", () => {
    expect(resolveSendingIdentity("a@notevents.westpeek.live")).toBe(BRAND_FROM_EMAIL);
    expect(resolveSendingIdentity("a@events.westpeek.live.evil.com")).toBe(BRAND_FROM_EMAIL);
  });

  it("refuses empty, missing and malformed values", () => {
    expect(resolveSendingIdentity("")).toBe(BRAND_FROM_EMAIL);
    expect(resolveSendingIdentity(undefined)).toBe(BRAND_FROM_EMAIL);
    expect(resolveSendingIdentity(null)).toBe(BRAND_FROM_EMAIL);
    expect(resolveSendingIdentity("not-an-address")).toBe(BRAND_FROM_EMAIL);
  });

  it("is case insensitive about the domain", () => {
    expect(isBrandSendingIdentity(`Notifications@Events.WestPeek.Live`)).toBe(true);
  });

  it("pulls the address out of both identity forms", () => {
    expect(emailAddressOf("a@b.com")).toBe("a@b.com");
    expect(emailAddressOf("Name <a@b.com>")).toBe("a@b.com");
    expect(emailAddressOf("nonsense")).toBe("");
  });
});

describe("withHouseAddresses", () => {
  it("overrides a stale from saved in Settings", async () => {
    vi.resetModules();
    vi.doMock("@/services/agencies/houseDefaultsService", () => ({
      getHouseDefaults: async () => ({ fromEmail: "old-address@westpeek.live", replyToEmail: "hello@westpeek.live" }),
    }));

    const { withHouseAddresses } = await import("@/services/email/emailService");
    const out = await withHouseAddresses({ to: "a@b.com", subject: "s", html: "<p>h</p>" });

    expect(out.from).toBe(BRAND_FROM_EMAIL);
    expect(out.replyTo).toBe("hello@westpeek.live");
    vi.doUnmock("@/services/agencies/houseDefaultsService");
  });

  it("still names a from when the house row cannot be read at all", async () => {
    vi.resetModules();
    vi.doMock("@/services/agencies/houseDefaultsService", () => ({
      getHouseDefaults: async () => {
        throw new Error("store down");
      },
    }));

    const { withHouseAddresses } = await import("@/services/email/emailService");
    const out = await withHouseAddresses({ to: "a@b.com", subject: "s", html: "<p>h</p>" });

    expect(out.from).toBe(BRAND_FROM_EMAIL);
    expect(out.replyTo).toBeTruthy();
    vi.doUnmock("@/services/agencies/houseDefaultsService");
  });
});
