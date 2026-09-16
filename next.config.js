const { execSync } = require("node:child_process");

/**
 * The build id every deploy carries. Inlined into the client bundle AND the Worker (NEXT_PUBLIC_),
 * so a page compares what it loaded with against what the server answers; when they differ the
 * venue reloads itself (BuildVersionWatchdog) instead of running a stale bundle until a hard
 * refresh (Scooter's workshop, 16 Sep 2026). Workers Builds sets WORKERS_CI_COMMIT_SHA; a local
 * build falls back to the git head, then to the clock.
 */
function resolveBuildId() {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || (process.env.NODE_ENV === "development" ? "dev" : resolveBuildId()),
  },
};

module.exports = nextConfig;
