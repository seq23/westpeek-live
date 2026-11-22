const { execSync } = require("node:child_process");

/**
 * The build id every deploy carries. Inlined into the client bundle AND the Worker (NEXT_PUBLIC_),
 * so a page compares what it loaded with against what the server answers; when they differ the
 * venue reloads itself (BuildVersionWatchdog) instead of running a stale bundle until a hard
 * refresh (Scooter's workshop, 16 Sep 2026). Workers Builds sets WORKERS_CI_COMMIT_SHA; a local
 * build falls back to the git head, then to the clock.
 */
function resolveBuildId() {
  const fromCi = process.env.DEPLOY_SHA || process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

/**
 * Security headers on every page and API answer. The CSP names no origins on purpose: the video rooms
 * (LiveKit, Daily, Zoom, Stream) load from many hosts, and a host list would break a show the day one
 * changes. It shuts what an injected page would need instead: plugins, a foreign <base>, being framed
 * by another site, and forms posting off-site. /api/assets/file is left out: it sets its own, stricter
 * sandbox CSP per file type, and object-src 'none' there would stop the browser's PDF viewer.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; upgrade-insecure-requests" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/((?!api/assets/file).*)", headers: SECURITY_HEADERS }];
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || (process.env.NODE_ENV === "development" ? "dev" : resolveBuildId()),
  },
};

module.exports = nextConfig;
module.exports.SECURITY_HEADERS = SECURITY_HEADERS;
