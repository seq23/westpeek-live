import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { gotoAndAssert } from "./assertNoAppError";
import { day1Default, requiredDay1Default } from "./day1AccessDefaults";

type RouteExpectation = {
  path: string;
  label: string;
  terms?: string[];
  anyOf?: string[];
  actions?: string[];
};


const DEFAULT_E2E_SECRET = "local-playwright-e2e-cookie-secret-1234567890";

function baseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
}

export function isDeployedBrowserRun() {
  const url = baseUrl();
  return process.env.PLAYWRIGHT_DEPLOYED === "1" || (!url.includes("127.0.0.1") && !url.includes("localhost"));
}

function isAccessGateBody(body: string) {
  return ["special guest gate", "production access", "crew password", "operator launchpad password", "special guest password", "continue to assigned portal", "enter the event code"].some((term) => body.includes(term));
}

function cookieSecure() {
  return baseUrl().startsWith("https://");
}

function expiresIn(hours: number) {
  return Math.floor((Date.now() + hours * 60 * 60 * 1000) / 1000);
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function createV5AccessCookie(payload: Record<string, unknown>, secret = process.env.V5_ACCESS_COOKIE_SECRET || day1Default("V5_ACCESS_COOKIE_SECRET", DEFAULT_E2E_SECRET)) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `v5.${body}.${signature}`;
}

function createSessionCookie() {
  return base64UrlEncode(JSON.stringify({
    accessToken: "local-playwright-gauntlet-session",
    refreshToken: "local-playwright-gauntlet-refresh",
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  }));
}

export async function grantAgencySession(page: Page) {
  await page.context().addCookies([{ 
    name: process.env.AUTH_SESSION_COOKIE_NAME || "agency_event_os_session",
    value: createSessionCookie(),
    url: baseUrl(),
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    expires: expiresIn(12),
  }]);
}

export async function grantCrewAccess(page: Page, role = "crew", eventId?: string) {
  await page.context().addCookies([{ 
    name: process.env.V5_CREW_COOKIE_NAME || "wpl_crew_access",
    value: createV5AccessCookie({ kind: "crew", role, eventId, issuedAt: Date.now(), expiresAt: Date.now() + 8 * 60 * 60 * 1000 }),
    url: baseUrl(),
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    expires: expiresIn(8),
  }]);
}


export async function grantOperatorAccess(page: Page, role = "executive_producer", eventId?: string) {
  await page.context().addCookies([{
    name: process.env.V5_OPERATOR_COOKIE_NAME || "wpl_operator_access",
    value: createV5AccessCookie({ kind: "operator", role, eventId, issuedAt: Date.now(), expiresAt: Date.now() + 8 * 60 * 60 * 1000 }),
    url: baseUrl(),
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    expires: expiresIn(8),
  }]);
}

export async function grantSpecialGuestAccess(page: Page, role: "client" | "speaker" | "sponsor" | "crew_lite" | "vip", eventId = "demo") {
  await page.context().addCookies([{ 
    name: process.env.V5_SPECIAL_GUEST_COOKIE_NAME || "wpl_guest_access",
    value: createV5AccessCookie({ kind: "special_guest", role, eventId, issuedAt: Date.now(), expiresAt: Date.now() + 12 * 60 * 60 * 1000 }),
    url: baseUrl(),
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    expires: expiresIn(12),
  }]);
}

function masterOperatorPassword() {
  return process.env.E2E_OWNER_PASSWORD
    || process.env.OWNER_MASTER_ACCESS_PASSWORD
    || process.env.E2E_OPERATOR_PASSWORD
    || process.env.OPERATOR_LAUNCHPAD_PASSWORD
    || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD");
}

/** The operator gate skips itself when a valid owner/operator cookie can already open `next`; only fill the form when it is shown. */
async function operatorGateIsShown(page: Page) {
  return /\/production-access\/operator/.test(page.url());
}

export async function loginAsOperator(page: Page, nextPath?: string) {
  const target = nextPath ? `/production-access/operator?next=${encodeURIComponent(nextPath)}` : "/production-access/operator";
  await gotoAndAssert(page, target);
  if (await operatorGateIsShown(page)) {
    await page.getByLabel(/operator launchpad password/i).fill(process.env.E2E_OPERATOR_PASSWORD || process.env.OPERATOR_LAUNCHPAD_PASSWORD || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
    await page.getByRole("button", { name: /enter operator launchpad/i }).click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  if (nextPath) await gotoAndAssert(page, nextPath);
}

export async function loginAsMasterOperator(page: Page, nextPath?: string) {
  const target = nextPath ? `/production-access/operator?next=${encodeURIComponent(nextPath)}` : "/production-access/operator";
  await gotoAndAssert(page, target);
  if (await operatorGateIsShown(page)) {
    await page.getByLabel(/operator launchpad password/i).fill(masterOperatorPassword());
    await page.getByRole("button", { name: /enter operator launchpad/i }).click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  if (nextPath) await gotoAndAssert(page, nextPath);
}

export async function loginAsSpecialGuest(page: Page, role: "client" | "speaker" | "sponsor" | "crew_lite" | "vip", eventCode = "demo", nextPath?: string) {
  const passwordByRole: Record<typeof role, string> = {
    client: requiredDay1Default("EVENT_DEMO_CLIENT_CODE"),
    speaker: requiredDay1Default("EVENT_DEMO_SPEAKER_CODE"),
    sponsor: requiredDay1Default("EVENT_DEMO_SPONSOR_CODE"),
    crew_lite: requiredDay1Default("EVENT_DEMO_CREW_LITE_CODE"),
    vip: requiredDay1Default("EVENT_DEMO_VIP_CODE"),
  };

  await gotoAndAssert(page, "/production-access/special-guest");
  await page.getByLabel(/event code/i).fill(eventCode);
  await page.getByLabel(/special guest password/i).fill(passwordByRole[role]);
  await page.getByRole("button", { name: /continue to assigned portal/i }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (nextPath) await gotoAndAssert(page, nextPath);
}

export async function expectVisibleRoute(page: Page, route: RouteExpectation) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await gotoAndAssert(page, route.path);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body.length, `${route.label} should render meaningful body copy`).toBeGreaterThan(40);

  if (isDeployedBrowserRun() && (isAccessGateBody(body) || route.path.startsWith("/app") || route.path.startsWith("/admin") || route.path.startsWith("/speaker") || route.path.startsWith("/sponsor") || route.path.startsWith("/crew") || route.path.startsWith("/client"))) {
    return;
  }

  for (const term of route.terms ?? []) {
    expect(body, `${route.label} should contain ${term}`).toContain(term.toLowerCase());
  }

  if (route.anyOf?.length) {
    expect(
      route.anyOf.some((term) => body.includes(term.toLowerCase())),
      `${route.label} should contain one of: ${route.anyOf.join(", ")}`,
    ).toBeTruthy();
  }

  for (const action of route.actions ?? []) {
    await expect(page.getByText(new RegExp(action, "i")).first(), `${route.label} action ${action} should be visible`).toBeVisible();
  }

  const materialErrors = [...pageErrors, ...consoleErrors].filter((entry) => {
    const text = entry.toLowerCase();
    return !text.includes("favicon") && !text.includes("hydration") && !text.includes("failed to load resource: the server responded with a status of 404");
  });

  expect(materialErrors, `${route.label} should not emit page/console errors`).toEqual([]);
}

export async function expectRouteMatrix(page: Page, routes: RouteExpectation[]) {
  for (const route of routes) {
    await expectVisibleRoute(page, route);
  }
}

export async function expectLinksStayFirstParty(page: Page, selector = "a[href]") {
  const hrefs = await page.locator(selector).evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  for (const href of hrefs) {
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    const url = new URL(href);
    const allowedHosts = ["127.0.0.1", "localhost", "westpeek.live", "www.westpeek.live", "productions.joinwestpeek.com"];
    const configuredHost = new URL(baseUrl()).hostname;
    if (!allowedHosts.includes(configuredHost)) allowedHosts.push(configuredHost);
    expect(allowedHosts, `first-party or local link expected: ${href}`).toContain(url.hostname);
  }
}
