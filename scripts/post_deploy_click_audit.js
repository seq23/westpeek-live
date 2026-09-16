const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

if (!baseUrl) {
  console.log("post_deploy_click_audit: SKIP (set SMOKE_BASE_URL or NEXT_PUBLIC_APP_URL)");
  process.exit(0);
}

const requiredStartPaths = [
  "/",
  "/join",
  "/production-access",
  "/privacy",
  "/terms",
  "/production-access/crew",
  "/production-access/operator",
  "/production-access/special-guest",
  "/request-event",
  "/production-access/launchpad",
  "/events/demo",
  "/venue/demo/lobby",
];

const requiredVenuePaths = [
  "/venue/demo/lobby",
  "/venue/event-summit/lobby",
  "/venue/event-summit/stage",
  "/venue/event-summit/sessions",
  "/venue/event-summit/breakouts",
  "/venue/event-summit/expo",
  "/venue/event-summit/networking",
  "/venue/event-summit/people",
  "/venue/event-summit/replay",
  "/venue/event-summit/help",
];

const requiredErrorMarkers = [
  "__next_error__",
  "Internal Server Error",
  "Application error",
  "500: Internal Server Error",
];

// A real Next.js error page carries `digest: "<numeric hash>"`. Since Next 15.5 every RSC payload also
// carries `"digest":"$undefined"` for streamed metadata, so a bare "digest" substring is a false positive
// on every page. Match the same shape the e2e helper (tests/e2e/helpers/assertNoAppError.ts) matches.
const serverErrorDigestPattern = /digest["']?\s*[:=]\s*["']?[0-9]{6,}/i;

const hardFailStatuses = new Set([500, 502, 503, 504]);

const allowedRedirectTargets = [
  "/production-access",
  "/privacy",
  "/terms",
  "/production-access/crew",
  "/production-access/operator",
  "/production-access/special-guest",
  "/request-event",
  "/login",
];

const skipPrefixes = [
  "/_next/",
  "/brand/",
  "/favicon",
  "/robots.txt",
  "/sitemap",
];

function toUrl(pathname) {
  return new URL(pathname, baseUrl);
}

function normalizeInternalHref(rawHref) {
  if (!rawHref) return null;
  const href = rawHref.trim();
  if (!href || href === "#") return null;
  if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return null;

  let url;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }

  const base = new URL(baseUrl);
  if (url.origin !== base.origin) return null;
  if (skipPrefixes.some((prefix) => url.pathname.startsWith(prefix))) return null;
  return url.pathname + url.search;
}

function extractInternalLinks(html) {
  const links = new Set();
  const hrefPattern = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefPattern.exec(html))) {
    const normalized = normalizeInternalHref(match[1]);
    if (normalized) links.add(normalized);
  }
  return Array.from(links).sort();
}

function hasGenericServerError(body) {
  return requiredErrorMarkers.some((marker) => body.includes(marker)) || serverErrorDigestPattern.test(body);
}

function isProtectedPath(pathname) {
  return pathname === "/production-access/launchpad" ||
    pathname === "/operator-packet" ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/admin/testing" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/client/") ||
    pathname === "/crew" ||
    pathname.startsWith("/crew/") ||
    pathname === "/speaker" ||
    pathname.startsWith("/speaker/") ||
    pathname === "/sponsor" ||
    pathname.startsWith("/sponsor/");
}

function isAllowedRedirect(location) {
  if (!location) return false;
  const normalized = normalizeInternalHref(location);
  if (!normalized) return false;
  return allowedRedirectTargets.some((target) => normalized === target || normalized.startsWith(target + "?") || normalized.startsWith(target + "/"));
}

async function fetchPath(pathname, source) {
  const response = await fetch(toUrl(pathname), { redirect: "manual" });
  const body = await response.text().catch(() => "");
  const location = response.headers.get("location") || "";
  return { pathname, source, response, body, location };
}

async function run() {
  const queue = [];
  const visited = new Set();
  const failures = [];
  const acceptedRedirects = [];

  for (const pathname of [...requiredStartPaths, ...requiredVenuePaths]) {
    queue.push({ pathname, source: "required" });
  }

  while (queue.length && visited.size < 160) {
    const next = queue.shift();
    if (!next || visited.has(next.pathname)) continue;
    visited.add(next.pathname);

    let result;
    try {
      result = await fetchPath(next.pathname, next.source);
    } catch (error) {
      failures.push(next.pathname + " fetch failed from " + next.source + ": " + error.message);
      continue;
    }

    const { response, body, location } = result;
    const status = response.status;

    if (hardFailStatuses.has(status)) {
      failures.push(next.pathname + " from " + next.source + " returned " + status);
      continue;
    }

    if (status >= 300 && status < 400) {
      if (isProtectedPath(next.pathname) && isAllowedRedirect(location)) {
        acceptedRedirects.push(next.pathname + " -> " + location);
        continue;
      }
      failures.push(next.pathname + " from " + next.source + " unexpected redirect " + status + " -> " + (location || "(missing location)"));
      continue;
    }

    if (status === 404 && requiredVenuePaths.includes(next.pathname)) {
      failures.push(next.pathname + " required venue path returned 404");
      continue;
    }

    if (status >= 400 && status !== 404) {
      failures.push(next.pathname + " from " + next.source + " returned unexpected status " + status);
      continue;
    }

    if (hasGenericServerError(body)) {
      failures.push(next.pathname + " from " + next.source + " contains generic server error marker");
      continue;
    }

    if (status === 200 && body.includes("<html")) {
      const links = extractInternalLinks(body);
      for (const link of links) {
        if (!visited.has(link)) queue.push({ pathname: link, source: next.pathname });
      }
    }
  }

  for (const required of requiredVenuePaths) {
    if (!visited.has(required)) failures.push("required venue path was not visited: " + required);
  }

  if (failures.length) {
    console.error("post_deploy_click_audit: FAIL");
    for (const failure of failures) console.error("- " + failure);
    console.error("\nVisited:");
    for (const item of Array.from(visited).sort()) console.error("- " + item);
    process.exit(1);
  }

  console.log("post_deploy_click_audit: PASS");
  console.log("Visited " + visited.size + " internal routes.");
  if (acceptedRedirects.length) {
    console.log("Accepted redirects:");
    for (const redirect of acceptedRedirects) console.log("- " + redirect);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
