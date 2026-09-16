import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { day1Default } from "./helpers/day1AccessDefaults";
import { grantCrewAccess, isDeployedBrowserRun } from "./helpers/roleJourney";

/**
 * The owner, on her phone as a plain attendee (16 Sep 2026): approved for the stage, but nothing to
 * tap. This walks the phone-width path with a fake camera:
 *   fresh stage → "Want to speak? Request to join the stage" (requests allowed by default) →
 *   request → "Requested — waiting for the crew" → crew approves → the line flips WITHOUT a reload
 *   and the control bar appears → tap Turn on camera → the local camera track is captured and
 *   previewed (published to the room the moment it connects; there is no LiveKit server in this
 *   run, so the bar reports preview) → crew revokes → the camera is stopped at once and the reason
 *   shown. Also: the first-visit coach strips on the stage and the lobby, dismissed once.
 * Runs in both projects; the mobile-chromium (Pixel 5) run is the proof that matters here.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

const EVENT = "event-summit";
const ATTENDEE_ID = `e2e-attendee-${EVENT}`;
const STAGE = `/venue/${EVENT}/stage`;
const CREW = `/crew/events/${EVENT}`;

function sign(body: string) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET || day1Default("LIVEKIT_WEBHOOK_SECRET", "local-playwright-livekit-webhook-secret-1234567890");
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Marks the seed stage live through the real webhook route, so the LiveKit player (not the pre-stream card) mounts. */
async function stageLive(request: APIRequestContext) {
  const body = JSON.stringify({ event: "ingress_started", eventId: EVENT, stageId: "main-stage", ingressInfo: { roomName: `${EVENT}-main-stage` } });
  const response = await request.post("/api/video/livekit-webhook", { data: Buffer.from(body), headers: { "content-type": "application/json", "x-livekit-signature": sign(body) } });
  expect(response.ok()).toBeTruthy();
}

async function attendeePage(browser: Browser) {
  const context = await browser.newContext({ permissions: ["camera", "microphone"] });
  const page = await context.newPage();
  await asRegisteredAttendee(page, EVENT);
  return { context, page };
}

async function crewPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await grantCrewAccess(page, "producer", EVENT);
  await gotoAndAssert(page, CREW);
  return { context, page };
}

async function expectRosterStatus(page: Page, status: string) {
  await expect(page.getByTestId(`roster-status-${ATTENDEE_ID}`)).toHaveAttribute("data-live-status", status);
}

async function openRequests(page: Page) {
  const form = page.getByTestId("live-room-control-forms").locator("form").first();
  const camera = form.locator('input[name="globalCameraEnabled"]');
  const mic = form.locator('input[name="globalMicrophoneEnabled"]');
  const kill = form.locator('input[name="emergencyPublishingDisabled"]');
  if (!(await camera.isChecked()) || !(await mic.isChecked()) || (await kill.isChecked())) {
    await camera.setChecked(true); await mic.setChecked(true); await kill.setChecked(false);
    await form.getByRole("button", { name: "Save main stage controls" }).click();
    await expect(page.getByTestId("live-room-control-forms").locator("form").first().locator('input[name="globalCameraEnabled"]')).toBeChecked();
  }
}

async function resetAttendee(page: Page) {
  const reset = page.getByTestId(`roster-reset-${ATTENDEE_ID}`);
  if (await reset.count()) { await reset.click(); await expectRosterStatus(page, "open"); }
}

test("approve → toggles appear → camera captured and previewed → revoke → stopped, on a phone", async ({ browser, request }) => {
  test.setTimeout(150_000);
  const crew = await crewPage(browser);
  await resetAttendee(crew.page);
  await openRequests(crew.page);
  await stageLive(request);

  const attendee = await attendeePage(browser);
  // No LiveKit server in this run: the token route answers with a stub so the CLIENT path is
  // proven — the player mounts, its token fetch completes, and the room surface reaches
  // token-issued within 10s (the self-cancelling effect of 16 Sep 2026 left it on "loading"
  // for good). A real media element with videoWidth > 0 needs the deployed LiveKit room.
  await attendee.page.route("**/api/video/livekit-token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { token: { token: "stub-attendee-token" }, livekitUrl: "wss://stub.livekit.invalid" }, permissions: { canPublishAudio: false, canPublishVideo: false, canShareScreen: false } }) });
  });
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-livekit-room-surface")).toHaveAttribute("data-livekit-consumption-state", "token-issued", { timeout: 10_000 });
  await attendee.page.unroute("**/api/video/livekit-token");

  // First visit: the coach strip, dismissed once.
  const coach = attendee.page.getByTestId("coach-strip-stage");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText(/Request to join the stage/);
  await coach.getByTestId("coach-strip-stage-dismiss").click();
  await expect(coach).toHaveCount(0);
  await attendee.page.reload();
  await expect(attendee.page.getByTestId("coach-strip-stage")).toHaveCount(0);

  // 1. Requests are open by default: the line says so with one button.
  const line = attendee.page.getByTestId("attendee-stage-status-headline");
  await expect(line).toHaveText(/Want to speak\? Request to join the stage/);
  await attendee.page.getByTestId("attendee-stage-request-button").click();
  await expect(attendee.page.getByTestId("attendee-stage-request-pending")).toBeVisible();
  await expect(line).toHaveText("Requested — waiting for the crew");
  await expect(attendee.page.getByTestId("attendee-stage-controls")).toHaveCount(0);

  // 2. The crew approves; the attendee's line flips without a reload and the control bar appears.
  await gotoAndAssert(crew.page, CREW);
  await crew.page.getByTestId(`pending-request-${ATTENDEE_ID}`).getByRole("button", { name: "Approve" }).click();
  await expectRosterStatus(crew.page, "approved_to_publish");
  await expect(attendee.page.getByTestId("attendee-stage-approved")).toBeVisible({ timeout: 20_000 });
  await expect(line).toHaveText(/Approved — turn on your camera/);
  await expect(attendee.page.getByTestId("attendee-stage-approved")).toContainText("Tap Turn on camera");
  const controls = attendee.page.getByTestId("attendee-stage-controls");
  await expect(controls).toBeVisible();
  await expect(controls).toHaveAttribute("data-camera", "off");
  await expect(controls).toHaveAttribute("data-mic", "off");
  await expect(controls.getByTestId("attendee-stage-controls-headline")).toContainText("Nothing is live until you tap");

  // Phone-width sanity: the whole bar and the toggles fit inside the viewport (no horizontal scroll).
  const viewport = attendee.page.viewportSize();
  const box = await controls.boundingBox();
  expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width + 1).toBeTruthy();
  const cameraBox = await controls.getByTestId("stage-camera-toggle").boundingBox();
  expect(cameraBox && cameraBox.height >= 48).toBeTruthy();

  // 3. Tap Turn on camera: the fake device is captured, the preview plays, and the bar reports it.
  await controls.getByTestId("stage-camera-toggle").click();
  await expect(controls).toHaveAttribute("data-camera", "on", { timeout: 15_000 });
  await expect(controls).toHaveAttribute("data-on-stage", "true");
  await expect(controls.getByTestId("attendee-stage-controls-headline")).toHaveText("On stage");
  const preview = controls.getByTestId("stage-local-preview");
  await expect(preview).toBeVisible();
  await expect.poll(async () => preview.evaluate((el) => { const v = el as HTMLVideoElement; const stream = v.srcObject as MediaStream | null; return stream ? stream.getVideoTracks().filter((track) => track.readyState === "live").length : 0; })).toBeGreaterThan(0);
  await expect(controls.getByTestId("stage-camera-toggle")).toHaveText(/Camera on/);
  // The mic stays off until tapped.
  await expect(controls).toHaveAttribute("data-mic", "off");

  // 4. The crew revokes: the camera is stopped at once, with the reason.
  await crew.page.getByTestId(`roster-revoke-${ATTENDEE_ID}`).click();
  await expectRosterStatus(crew.page, "revoked");
  await expect(controls).toHaveAttribute("data-camera", "off", { timeout: 20_000 });
  await expect(attendee.page.getByTestId("attendee-live-access-revoked")).toBeVisible();
  await expect(line).toHaveText("Removed by the crew");
  await expect(controls.getByTestId("attendee-stage-controls-headline")).toHaveText("Removed by the crew");
  await expect(controls.getByTestId("attendee-stage-notice")).toContainText(/revoked/i);
  await expect(controls.getByTestId("stage-camera-toggle")).toBeDisabled();

  // Lobby coach strip too.
  await gotoAndAssert(attendee.page, `/venue/${EVENT}/lobby`);
  const lobbyCoach = attendee.page.getByTestId("coach-strip-lobby");
  await expect(lobbyCoach).toContainText("Stage = watch and speak");
  await lobbyCoach.getByTestId("coach-strip-lobby-dismiss").click();
  await expect(lobbyCoach).toHaveCount(0);

  await resetAttendee(crew.page);
  await attendee.context.close();
  await crew.context.close();
});

test("when the crew closes stage requests the attendee is told, never left silent", async ({ browser }) => {
  test.setTimeout(90_000);
  const crew = await crewPage(browser);
  await resetAttendee(crew.page);
  const form = crew.page.getByTestId("live-room-control-forms").locator("form").first();
  await form.locator('input[name="globalCameraEnabled"]').setChecked(false);
  await form.locator('input[name="globalMicrophoneEnabled"]').setChecked(false);
  await form.getByRole("button", { name: "Save main stage controls" }).click();
  await expect(crew.page.getByTestId("live-room-control-forms").locator("form").first().locator('input[name="globalCameraEnabled"]')).not.toBeChecked();

  const attendee = await attendeePage(browser);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-stage-requests-closed")).toContainText("The crew has closed stage requests for now");
  await expect(attendee.page.getByTestId("attendee-stage-request-form")).toHaveCount(0);

  await openRequests(crew.page);
  await expect(attendee.page.getByTestId("attendee-stage-status-headline")).toHaveText(/Request to join the stage/, { timeout: 20_000 });
  await attendee.context.close();
  await crew.context.close();
});
