import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { day1Default } from "./helpers/day1AccessDefaults";
import { grantCrewAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Intentional end vs dropped feed, through the real pages and the real webhook route:
 *   order A — crew presses "End the show" on the crew console, THEN the ingress_ended webhook
 *             arrives → the stage is ENDED, not Daily; the event is `ended`;
 *   order B — the operator ends the event from the publish page (no stage mark), THEN
 *             ingress_ended arrives → ENDED, not Daily;
 *   control — a live event whose feed drops with neither → Daily.
 * Also: the testing console shows the exact webhook URL and which path last carried the state.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

function sign(body: string) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET || day1Default("LIVEKIT_WEBHOOK_SECRET", "local-playwright-livekit-webhook-secret-1234567890");
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function webhook(request: APIRequestContext, eventId: string, event: "ingress_started" | "ingress_ended") {
  const body = JSON.stringify({ event, eventId, stageId: "main-stage", ingressInfo: { roomName: `${eventId}-main-stage` } });
  const response = await request.post("/api/video/livekit-webhook", { data: Buffer.from(body), headers: { "content-type": "application/json", "x-livekit-signature": sign(body) } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).state as { streamStatus: string; activeStreamSource: string; operatorMarkedShowEnded: boolean };
}

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

async function publicStageStatus(request: APIRequestContext, eventId: string) {
  const response = await request.get(`/api/video/stage-stream-state?eventId=${eventId}&stageId=main-stage`);
  return (await response.json()).state as { streamStatus: string; activeStreamSource: string };
}

test("order A: End the show on the crew console, then ingress_ended → ENDED, event ended, no Daily", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const eventId = await createNowEvent(page, `End Show A ${Date.now()}`);
  expect((await webhook(request, eventId, "ingress_started")).streamStatus).toBe("LIVEKIT_INGRESS_LIVE");

  const crewContext = await browser.newContext();
  const crew = await crewContext.newPage();
  await grantCrewAccess(crew, "technical_director", eventId);
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  const control = crew.getByTestId("end-show-control");
  await expect(control).toHaveAttribute("data-show-ended", "false");
  await control.getByTestId("end-show-button").click();
  await expect(crew.getByTestId("end-show-control")).toHaveAttribute("data-show-ended", "true");
  await expect(crew.getByTestId("end-show-ended-badge")).toContainText("event ended");

  const after = await webhook(request, eventId, "ingress_ended");
  expect(after.streamStatus).toBe("ENDED");
  expect(after.activeStreamSource).toBe("LIVEKIT_INGRESS");
  expect(after.operatorMarkedShowEnded).toBe(true);
  expect((await publicStageStatus(request, eventId)).streamStatus).toBe("ENDED");

  // The operator sees the same on the command page and the testing console, with the webhook path named.
  await gotoAndAssert(page, `/app/events/${eventId}`);
  await expect(page.getByTestId("end-show-control")).toHaveAttribute("data-show-ended", "true");
  await gotoAndAssert(page, `/admin/testing/${eventId}`);
  await expect(page.getByTestId("livekit-webhook-url")).toContainText("/api/video/livekit-webhook");
  await expect(page.getByTestId("livekit-webhook-help")).toContainText("Settings → Webhooks");
  await expect(page.getByTestId("last-webhook-card")).toHaveAttribute("data-path", "webhook");
  await expect(page.getByTestId("last-webhook-card")).toContainText("ingress_ended");
  await crewContext.close();
});

test("order B: the event is ended from the publish page first, then ingress_ended → ENDED, not Daily", async ({ page, request }) => {
  test.setTimeout(120_000);
  const eventId = await createNowEvent(page, `End Show B ${Date.now()}`);
  expect((await webhook(request, eventId, "ingress_started")).streamStatus).toBe("LIVEKIT_INGRESS_LIVE");

  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  await expect(page.getByTestId("end-show-control")).toHaveAttribute("data-show-ended", "false");
  await page.getByTestId("publish-ended").click();
  await expect(page).toHaveURL(/updated=ended/);

  const after = await webhook(request, eventId, "ingress_ended");
  expect(after.streamStatus).toBe("ENDED");
  expect(after.activeStreamSource).toBe("LIVEKIT_INGRESS");
  expect((await publicStageStatus(request, eventId)).streamStatus).toBe("ENDED");
});

test("control: a live event whose feed drops with no end mark still fails over to Daily", async ({ page, request }) => {
  test.setTimeout(120_000);
  const eventId = await createNowEvent(page, `Dropped Feed ${Date.now()}`);
  expect((await webhook(request, eventId, "ingress_started")).streamStatus).toBe("LIVEKIT_INGRESS_LIVE");
  const after = await webhook(request, eventId, "ingress_ended");
  expect(after.activeStreamSource).toBe("DAILY");
  expect(after.streamStatus).not.toBe("ENDED");
  await gotoAndAssert(page, `/admin/testing/${eventId}`);
  await expect(page.getByTestId("last-webhook-card")).toHaveAttribute("data-path", "webhook");
});
