import type { FullConfig } from "@playwright/test";

// Warm-up for the local `next dev` server. `next dev` compiles each route on its first request,
// and on a cold CI runner that first compile can eat most of a test's 30 s budget, so the test
// that happens to hit a route first fails on a compile, not on a defect. Playwright starts the
// webServer before globalSetup, so this requests the heavy routes once, each with its own
// ceiling, and every test then runs against compiled pages under the normal per-test timeout.
// A route that does not answer within its ceiling fails the run here, by name, instead of
// surfacing later as an unexplained timeout in whichever spec came first.
const WARM_ROUTES = [
  "/",
  "/manual",
  "/request-event",
  "/events/demo/register",
  "/venue/demo/stage",
  "/venue/demo/breakouts",
  "/venue/demo/networking",
  "/venue/demo/people",
  "/venue/demo/help",
  "/production-access/crew",
  "/production-access/launchpad",
  "/production-access/owner",
  "/production-access/special-guest/preview",
  "/app/owner",
  "/app/events",
  "/app/people",
  "/crew",
  "/speaker",
];
const PER_ROUTE_CEILING_MS = 180_000;

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!config.webServer || !baseURL) return;
  for (const route of WARM_ROUTES) {
    const started = Date.now();
    const response = await fetch(new URL(route, baseURL), { redirect: "manual", signal: AbortSignal.timeout(PER_ROUTE_CEILING_MS) });
    if (response.status >= 500) throw new Error(`warm-up: ${route} answered ${response.status} after ${Date.now() - started} ms`);
  }
}
