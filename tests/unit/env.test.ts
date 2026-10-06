import fs from "node:fs";
import { describe, expect, it } from "vitest";
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
});
