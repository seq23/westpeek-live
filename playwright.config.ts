import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import envRegistry from "./deployment/env-var-registry.json";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.POSTDEPLOY_BASE_URL || process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium";
const executablePath = fs.existsSync(systemChromium) ? systemChromium : undefined;
const disableVideo = process.env.PLAYWRIGHT_DISABLE_VIDEO === "1" || process.env.PLAYWRIGHT_DISABLE_VIDEO === "true";
const headed = process.env.PLAYWRIGHT_HEADED === "1" || process.env.PLAYWRIGHT_HEADED === "true";
const evidenceMode = process.env.PLAYWRIGHT_EVIDENCE_MODE === "1" || process.env.PLAYWRIGHT_EVIDENCE_MODE === "true";
const retries = Number.parseInt(process.env.PLAYWRIGHT_RETRIES || (process.env.CI ? "1" : "0"), 10);
const isLocalBaseURL = baseURL.includes("127.0.0.1") || baseURL.includes("localhost");
const deployedRun = process.env.PLAYWRIGHT_DEPLOYED === "1" || !isLocalBaseURL;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1" || process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";
const shouldStartLocalServer = !deployedRun && !skipWebServer;
const localRuntimePath = process.env.AGENCY_EVENT_OS_RUNTIME_STORE_PATH || ".runtime-data/local-playwright-runtime.json";
const day1Defaults = envRegistry.demoDefaults as Record<string, string | undefined>;

function isPlaceholderEnvValue(value: string | undefined) {
  if (!value) return true;
  const normalized = value.trim();
  return !normalized || normalized === "REPLACE_WITH_LOCAL_SECRET" || normalized === "REPLACE_WITH_LOCAL_CODE" || normalized.startsWith("REPLACE_WITH_") || normalized === "<32+ character internal cookie secret>";
}

function readLocalEnvValue(key: string) {
  if (!fs.existsSync(".env.local")) return undefined;
  const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf("=") + 1).trim().replace(/^[\"']|[\"']$/g, "");
  return isPlaceholderEnvValue(value) ? undefined : value;
}

const day1Default = (key: string, fallback = ""): string => {
  const runtime = process.env[key];
  if (runtime && !isPlaceholderEnvValue(runtime)) return runtime;
  return readLocalEnvValue(key) || day1Defaults[key] || fallback;
};

const chromiumArgs = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-proxy-server",
  "--proxy-bypass-list=*",
  "--allow-insecure-localhost",
  "--disable-web-security",
  "--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights",
  // A fake camera and microphone, granted without a prompt: the attendee on-stage controls are
  // proven on a phone-width project by capturing a real (synthetic) local track.
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];

if (executablePath && !headed) {
  chromiumArgs.unshift("--headless=new");
}

const localE2EEnv = {
  PLAYWRIGHT_LOCAL_E2E: "1",
  LOCAL_PLAYWRIGHT_GAUNTLET_AUTH: "true",
  PLAYWRIGHT_DEPLOYED: "0",
  PLAYWRIGHT_BASE_URL: baseURL,
  NODE_ENV: "development",
  NEXT_PUBLIC_APP_URL: baseURL,
  AGENCY_EVENT_OS_RUNTIME_STORE: "file",
  AGENCY_EVENT_OS_RUNTIME_STORE_PATH: localRuntimePath,
  ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION: "true",
  VIDEO_PROVIDER: "mock",
  ALLOW_MOCK_VIDEO_PROVIDER_IN_PRODUCTION: "true",
  DAILY_FALLBACK_ENABLED: "false",
  DAILY_STAGE_FALLBACK_REQUIRES_TOKEN: "true",
  STREAMYARD_PRIMARY_ENABLED: "true",
  STAGE_STREAM_DEFAULT_SOURCE: "LIVEKIT_INGRESS",
  V5_ACCESS_COOKIE_SECRET: day1Default("V5_ACCESS_COOKIE_SECRET", "local-playwright-e2e-cookie-secret-1234567890"),
  CREW_ACCESS_PASSWORD: day1Default("CREW_ACCESS_PASSWORD"),
  OPERATOR_LAUNCHPAD_PASSWORD: day1Default("OPERATOR_LAUNCHPAD_PASSWORD"),
  OWNER_MASTER_ACCESS_PASSWORD: day1Default("OWNER_MASTER_ACCESS_PASSWORD"),
  AUTH_SESSION_COOKIE_NAME: process.env.AUTH_SESSION_COOKIE_NAME || "agency_event_os_session",
  V5_CREW_COOKIE_NAME: process.env.V5_CREW_COOKIE_NAME || "wpl_crew_access",
  V5_OPERATOR_COOKIE_NAME: process.env.V5_OPERATOR_COOKIE_NAME || "wpl_operator_access",
  V5_OWNER_COOKIE_NAME: process.env.V5_OWNER_COOKIE_NAME || "wpl_owner_access",
  V5_SPECIAL_GUEST_COOKIE_NAME: process.env.V5_SPECIAL_GUEST_COOKIE_NAME || "wpl_guest_access",
  EVENT_DEMO_SPEAKER_CODE: day1Default("EVENT_DEMO_SPEAKER_CODE"),
  EVENT_DEMO_SPONSOR_CODE: day1Default("EVENT_DEMO_SPONSOR_CODE"),
  EVENT_DEMO_VIP_CODE: day1Default("EVENT_DEMO_VIP_CODE"),
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  LIVEKIT_URL: day1Default("LIVEKIT_URL"),
  LIVEKIT_API_KEY: day1Default("LIVEKIT_API_KEY"),
  LIVEKIT_API_SECRET: day1Default("LIVEKIT_API_SECRET"),
  LIVEKIT_WEBHOOK_SECRET: day1Default("LIVEKIT_WEBHOOK_SECRET", "local-playwright-livekit-webhook-secret-1234567890"),
  DAILY_API_KEY: "",
  DAILY_DOMAIN: "",
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: shouldStartLocalServer
    ? {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
        env: localE2EEnv,
      }
    : undefined,
  use: {
    baseURL,
    trace: evidenceMode ? "on" : "retain-on-failure",
    screenshot: evidenceMode ? "on" : "only-on-failure",
    video: disableVideo ? "off" : (evidenceMode ? "on" : "on-first-retry"),
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: headed ? false : undefined,
        launchOptions: { executablePath, args: chromiumArgs },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        headless: headed ? false : undefined,
        launchOptions: { executablePath, args: chromiumArgs },
      },
    },
  ],
});
