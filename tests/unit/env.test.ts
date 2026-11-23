import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv, isResendConfigured } from "@/lib/env";

describe("env helpers", () => {
  it("detects email config from the key alone", () => {
    const base = {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      EMAIL_FROM: "events@example.com",
      AUTH_SESSION_COOKIE_NAME: "agency_event_os_session",
      VIDEO_PROVIDER: "mock" as const,
      DAILY_API_KEY: "",
      DAILY_API_BASE_URL: "https://api.daily.co/v1",
      DAILY_DOMAIN: "",
      DAILY_FALLBACK_ENABLED: "false" as const,
    };
    expect(isResendConfigured({ ...base, RESEND_API_KEY: "re_test" })).toBe(true);
    expect(isResendConfigured({ ...base, RESEND_API_KEY: "" })).toBe(false);
  });

  it("carries no Supabase variable: the database and files are bindings (DB, ASSETS_BUCKET), not env", () => {
    const env = getEnv() as unknown as Record<string, unknown>;
    expect(Object.keys(env).filter((key) => /SUPABASE/i.test(key))).toEqual([]);
    const source = fs.readFileSync("lib/env.ts", "utf8");
    expect(source).not.toMatch(/supabase/i);
    const wrangler = fs.readFileSync("wrangler.jsonc", "utf8");
    expect(wrangler).toContain('"binding": "DB"');
    expect(wrangler).toContain('"binding": "ASSETS_BUCKET"');
  });

  describe("validation under zod 4 refuses what it refused before, and still allows empty optionals", () => {
    afterEach(() => vi.unstubAllEnvs());
    const good = () => {
      vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD", "owner-test-master-2027");
      vi.stubEnv("V5_ACCESS_COOKIE_SECRET", "test-cookie-secret-test-cookie-secret");
    };

    it("a good set parses, and empty optional fields stay allowed", () => {
      good();
      vi.stubEnv("EMAIL_REPLY_TO", "");
      vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD_2", "");
      const env = getEnv();
      expect(env.NEXT_PUBLIC_APP_URL).toMatch(/^https?:\/\//);
      expect(env.EMAIL_REPLY_TO).toBe("");
    });

    it("refuses an owner password under 12 characters, a second one too short, a bad reply-to, a bad app URL and a bad from line", () => {
      good();
      vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD", "short");
      expect(() => getEnv()).toThrow(/OWNER_MASTER_ACCESS_PASSWORD/);
      good();
      vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD_2", "short2");
      expect(() => getEnv()).toThrow(/OWNER_MASTER_ACCESS_PASSWORD_2/);
      good();
      vi.stubEnv("EMAIL_REPLY_TO", "not-an-address");
      expect(() => getEnv()).toThrow(/EMAIL_REPLY_TO/);
      vi.stubEnv("EMAIL_REPLY_TO", "");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
      expect(() => getEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
      vi.stubEnv("EMAIL_FROM", "Name <broken");
      expect(() => getEnv()).toThrow(/EMAIL_FROM must be/);
    });
  });
});
