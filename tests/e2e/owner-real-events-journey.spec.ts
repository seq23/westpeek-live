import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

/**
 * The owner's real-event journeys (locked design, 15 Sep 2026):
 *  (a) owner cookie → New event → NOW → lands in the lobby with a join code → a second browser context joins via /join?code= and reaches the lobby
 *  (b) LATER → publish → /join finds it
 *  (c) archive hides the event, restore shows it again
 *  (d) the compiled seed `demo` still resolves
 */

const forbidden = /Supabase Auth required|login\?next=|Application error|Internal Server Error|NEXT_REDIRECT/i;

async function loginOwner(page: Page) {
  await gotoAndAssert(page, "/production-access/owner");
  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(page).toHaveURL(/\/app/);
}

async function joinFromFreshContext(browser: Browser, code: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await gotoAndAssert(page, `/join?code=${encodeURIComponent(code)}`);
    return { page, context };
  } catch (error) {
    await context.close();
    throw error;
  }
}

test.describe("owner real events", () => {
  test("(a) NOW creates a live Room, lands in the lobby with a code, and a second context joins through /join", async ({ page, browser }) => {
    await loginOwner(page);
    await gotoAndAssert(page, "/app/events/new");
    await expect(page.getByRole("heading", { name: /Start a Room now/i })).toBeVisible();
    await expect(page.getByTestId("runtime-schema-stop")).toHaveCount(0);

    const name = `Playwright Room ${Date.now()}`;
    await page.getByTestId("when-now").check();
    await page.getByLabel(/^Event name/i).fill(name);
    await page.getByLabel(/^Format/i).selectOption("room");
    await page.getByTestId("create-event-submit").click();

    await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
    await expect(page.getByTestId("event-created-notice")).toContainText(/is live/i);
    const code = (await page.getByTestId("event-join-code").innerText()).trim();
    expect(code).toMatch(/^wpl-[a-z0-9]{6}$/);
    await expect(page.getByTestId("event-join-link")).toContainText(`/join?code=${code}`);
    await expect(page.getByTestId("copy-join-code")).toBeVisible();
    await expect(page.locator("body")).toContainText(name);
    await expect(page.locator("body")).not.toContainText(forbidden);

    const joiner = await joinFromFreshContext(browser, code);
    try {
      await expect(joiner.page.locator("body")).toContainText(/Event found/i);
      await expect(joiner.page.locator("body")).toContainText(name);
      await joiner.page.getByRole("link", { name: /Continue/i }).click();
      await expect(joiner.page).toHaveURL(/\/venue\/[a-z0-9-]+\/stage/); // a live Room lands on the stage
      await expect(joiner.page.locator("body")).toContainText(name);
      // Attendees never see the host panel.
      await expect(joiner.page.getByTestId("host-join-code-banner")).toHaveCount(0);
      await expect(joiner.page.locator("body")).not.toContainText(forbidden);
    } finally {
      await joiner.context.close();
    }
  });

  test("(b) LATER creates a draft that /join refuses until Publish, then finds it", async ({ page, browser }) => {
    await loginOwner(page);
    await gotoAndAssert(page, "/app/events/new?when=later");
    const name = `Playwright Planned ${Date.now()}`;
    await page.getByTestId("when-later").check();
    await page.getByLabel(/^Event name/i).fill(name);
    await page.getByLabel(/New client name/i).fill("Playwright Client Co");
    await page.getByLabel(/^Type/i).selectOption("webinar");
    await page.getByTestId("create-event-submit").click();

    await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\?created=1/);
    await expect(page.getByTestId("event-created-notice")).toContainText(/created as a draft/i);
    await expect(page.getByTestId("runtime-event-header")).toContainText(/Draft/);
    await expect(page.getByTestId("runtime-event-header")).toContainText("Playwright Client Co");
    const code = (await page.getByTestId("event-join-code").innerText()).trim();

    const closed = await joinFromFreshContext(browser, code);
    try {
      await expect(closed.page.locator("body")).toContainText(/not publicly open yet/i);
    } finally {
      await closed.context.close();
    }

    await page.getByTestId("publish-event").click();
    await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\/publish\?updated=registration_open/);
    await expect(page.locator("body")).toContainText(/registration open/i);

    const open = await joinFromFreshContext(browser, code);
    try {
      await expect(open.page.locator("body")).toContainText(/Event found/i);
      await expect(open.page.locator("body")).toContainText(name);
      await open.page.getByRole("link", { name: /Continue/i }).click();
      await expect(open.page).toHaveURL(/\/events\/[a-z0-9-]+/);
      await expect(open.page.locator("body")).toContainText(name);
      await expect(open.page.locator("body")).not.toContainText(forbidden);
    } finally {
      await open.context.close();
    }
  });

  test("(c) archive hides the event from the list and /join; restore brings it back", async ({ page, browser }) => {
    await loginOwner(page);
    await gotoAndAssert(page, "/app/events/new");
    const name = `Playwright Archive ${Date.now()}`;
    await page.getByTestId("when-now").check();
    await page.getByLabel(/^Event name/i).fill(name);
    await page.getByTestId("create-event-submit").click();
    await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
    const code = (await page.getByTestId("event-join-code").innerText()).trim();
    const eventId = new URL(page.url()).pathname.split("/")[2];

    await gotoAndAssert(page, "/app/events");
    await expect(page.getByTestId(`event-card-${eventId}`)).toBeVisible();

    await gotoAndAssert(page, `/app/events/${eventId}`);
    await page.getByTestId("archive-event").click();
    await expect(page).toHaveURL(/\/app\/events\?archived=/);
    await expect(page.getByTestId(`event-card-${eventId}`)).toHaveCount(0);

    const archived = await joinFromFreshContext(browser, code);
    try {
      await expect(archived.page.locator("body")).toContainText(/archived/i);
    } finally {
      await archived.context.close();
    }

    await gotoAndAssert(page, "/app/events?showArchived=1");
    await expect(page.getByTestId(`event-card-${eventId}`)).toBeVisible();
    await gotoAndAssert(page, `/app/events/${eventId}`);
    await page.getByTestId("restore-event").click();
    await expect(page).toHaveURL(/restored=/);
    await gotoAndAssert(page, "/app/events");
    await expect(page.getByTestId(`event-card-${eventId}`)).toBeVisible();

    const restored = await joinFromFreshContext(browser, code);
    try {
      await expect(restored.page.locator("body")).toContainText(/Event found/i);
    } finally {
      await restored.context.close();
    }
  });

  test("(d) the compiled seed demo event still resolves through /join and the lobby", async ({ page }) => {
    await gotoAndAssert(page, "/join?code=demo");
    await expect(page.locator("body")).toContainText(/Event found/i);
    await expect(page.locator("body")).toContainText(/Nova Founder Summit/i);
    await gotoAndAssert(page, "/venue/demo/lobby");
    await expect(page.locator("body")).toContainText(/Nova Founder Summit/i);
    await expect(page.getByTestId("host-join-code-banner")).toHaveCount(0);
  });

  test("(e) the workspace reads real rows: dashboard, clients, settings, and the runtime health endpoint", async ({ page, request }) => {
    const health = await request.get("/api/runtime/health");
    expect(health.status()).toBe(200);
    const body = await health.json();
    expect(body.seedEvents).toBe(5);
    expect(body.runtimeEvents.ready).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|wpl-[a-z0-9]{6}|CREW-/);

    await loginOwner(page);
    await expect(page.getByTestId("workspace-actor")).toContainText("Sequoia Taylor / owner");
    await expect(page.getByTestId("persistence-mode")).toContainText(/tables ready/i);
    await expect(page.locator("body")).not.toContainText(/Mock fallback|S\.L\. Taylor|Nova Founder Summit/);

    await gotoAndAssert(page, "/app/clients");
    const clientName = `Playwright Client ${Date.now()}`;
    await page.getByLabel(/^Client name/i).fill(clientName);
    await page.getByLabel(/^Industry/i).fill("QA");
    await page.getByTestId("create-client-submit").click();
    await expect(page).toHaveURL(/\/app\/clients\?client=/);
    await expect(page.getByTestId("client-created-notice")).toBeVisible();
    await expect(page.locator("body")).toContainText(clientName);
    await expect(page.locator("body")).not.toContainText(/Nova Capital Partners|Acme Health|Lumen/);

    await page.getByRole("link", { name: clientName }).click();
    await expect(page.locator("body")).toContainText(clientName);
    await page.getByRole("link", { name: /New event for/i }).click();
    await expect(page).toHaveURL(/\/app\/events\/new\?when=later&clientId=/);
    const eventName = `Playwright Client Event ${Date.now()}`;
    await page.getByLabel(/^Event name/i).fill(eventName);
    await page.getByTestId("create-event-submit").click();
    await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\?created=1/);
    await expect(page.getByTestId("runtime-event-header")).toContainText(clientName);

    await gotoAndAssert(page, "/app");
    await expect(page.getByTestId("dashboard-events")).toContainText(eventName);

    await gotoAndAssert(page, "/app/settings");
    const agencyName = `West Peek ${Date.now() % 1000}`;
    await page.getByTestId("settings-agency-name").fill(agencyName);
    await page.getByLabel(/Member 2 name/i).fill("Playwright Producer");
    await page.getByLabel(/Member 2 email/i).fill("producer@example.com");
    await page.getByLabel(/Member 2 role/i).fill("producer");
    await page.getByTestId("settings-save").click();
    await expect(page).toHaveURL(/\/app\/settings\?saved=1/);
    await expect(page.getByTestId("settings-saved")).toContainText(/Sequoia Taylor \/ owner/);
    await expect(page.getByTestId("settings-agency-name")).toHaveValue(agencyName);
    await expect(page.getByLabel(/Member 2 name/i)).toHaveValue("Playwright Producer");
    await gotoAndAssert(page, "/app");
    await expect(page.locator("body")).toContainText(agencyName);
  });
});
