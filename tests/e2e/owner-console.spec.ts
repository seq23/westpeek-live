import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { day1Default, requiredDay1Default } from "./helpers/day1AccessDefaults";
import { grantCrewAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The Owner Console: the owner gate lands here; a sticky table of contents; every section folds
 * and remembers; Live now lists the live Room with its feed and opens the crew console; the
 * stage-requests switch flips the room from the console and the crew deck header; the actor chip
 * links back here. Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

const SECTIONS = ["live-now", "events", "crews", "operators", "guests", "networking", "replays", "settings"];

function sign(body: string) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET || day1Default("LIVEKIT_WEBHOOK_SECRET", "local-playwright-livekit-webhook-secret-1234567890");
  return createHmac("sha256", secret).update(body).digest("hex");
}
async function ingressStarted(request: APIRequestContext, eventId: string) {
  const body = JSON.stringify({ event: "ingress_started", eventId, stageId: "main-stage", ingressInfo: { roomName: `${eventId}-main-stage` } });
  const response = await request.post("/api/video/livekit-webhook", { data: Buffer.from(body), headers: { "content-type": "application/json", "x-livekit-signature": sign(body) } });
  expect(response.ok()).toBeTruthy();
}
async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

test("owner gate → console → TOC, folds that remember, Live now opens the crew console, stage requests switch", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Console ${Date.now()}`);
  await ingressStarted(request, eventId);

  const context = await browser.newContext();
  const owner = await context.newPage();
  await gotoAndAssert(owner, "/production-access/owner");
  await owner.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await owner.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(owner).toHaveURL(/\/app\/owner$/);
  await expect(owner.getByTestId("owner-console")).toBeVisible();
  await expect(owner.getByTestId("workspace-actor")).toHaveAttribute("href", "/app/owner");
  // The folds are client components; wait for hydration before clicking (a click before it is lost).
  await expect(owner.getByTestId("console-section-live-now")).toHaveAttribute("data-hydrated", "true");

  // TOC chips for every section; only Live now open by default.
  for (const id of SECTIONS) await expect(owner.getByTestId(`console-toc-${id}`)).toBeVisible();
  await expect(owner.getByTestId("console-section-live-now")).toHaveAttribute("data-open", "true");
  for (const id of SECTIONS.slice(1)) await expect(owner.getByTestId(`console-section-${id}`)).toHaveAttribute("data-open", "false");

  // Each section expands and collapses; the state survives a reload.
  for (const id of SECTIONS.slice(1)) {
    await owner.getByTestId(`console-section-${id}-toggle`).click();
    await expect(owner.getByTestId(`console-section-${id}`)).toHaveAttribute("data-open", "true");
  }
  await owner.getByTestId("console-section-events-toggle").click();
  await expect(owner.getByTestId("console-section-events")).toHaveAttribute("data-open", "false");
  await owner.reload();
  await expect(owner.getByTestId("console-section-live-now")).toHaveAttribute("data-hydrated", "true");
  await expect(owner.getByTestId("console-section-crews")).toHaveAttribute("data-open", "true");
  await expect(owner.getByTestId("console-section-events")).toHaveAttribute("data-open", "false");
  await expect(owner.getByTestId("console-section-guests")).toHaveAttribute("data-open", "true");

  // Live now: the Room, its feed, the crew console link, the stage-requests switch.
  const row = owner.getByTestId(`console-live-${eventId}`);
  await expect(row).toBeVisible();
  await expect(row.getByTestId(`console-live-feed-${eventId}`)).toHaveText("live");
  await expect(row.getByTestId("stage-requests-toggle")).toHaveAttribute("data-open", "true");
  await row.getByTestId("stage-requests-switch").click();
  await expect(owner.getByTestId(`console-live-${eventId}`).getByTestId("stage-requests-toggle")).toHaveAttribute("data-open", "false");
  await expect(owner.getByTestId(`console-live-${eventId}`).getByTestId("stage-requests-state")).toHaveText("Closed");
  // The crew deck header shows the same switch, the same state; a producer flips it back.
  const crewContext = await browser.newContext();
  const crew = await crewContext.newPage();
  await grantCrewAccess(crew, "producer", eventId);
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  await expect(crew.getByTestId("stage-requests-toggle")).toHaveAttribute("data-open", "false");
  await crew.getByTestId("stage-requests-switch").click();
  await expect(crew.getByTestId("stage-requests-toggle")).toHaveAttribute("data-open", "true");
  await expect(crew.getByTestId("stage-requests-toggle")).toContainText("anyone can raise a hand");
  await crewContext.close();
  // Open crew console from the row.
  await owner.getByTestId(`console-open-crew-${eventId}`).click();
  await expect(owner).toHaveURL(new RegExp(`/crew/events/${eventId}$`));
  await expect(owner.getByTestId("crew-role-badge")).toContainText("You are in as Owner");

  // Crews and guests sections carry the event; settings shows the build.
  await gotoAndAssert(owner, "/app/owner");
  await expect(owner.getByTestId(`console-crew-${eventId}`)).toBeVisible();
  await expect(owner.getByTestId(`console-guests-${eventId}`)).toBeVisible();
  await expect(owner.getByTestId("console-crew-password-status")).toContainText(/set/);
  await expect(owner.getByTestId("console-build")).toBeVisible();
  await expect(owner.getByTestId("console-supabase-status")).toHaveAttribute("data-ok", "true");
  await context.close();

  // An operator is sent to the launchpad, not the console.
  await page.goto("/app/owner");
  await expect(page).toHaveURL(/\/production-access\/launchpad/);
});
