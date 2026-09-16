import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantCrewAccess, grantSpecialGuestAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The real special-guest flow on a runtime event, end to end:
 *   speaker code → identity once → green room (backstage) → tech check recorded on the roster →
 *   crew writes 3 cue cards → speaker sees them in order → speaker pastes notes → crew approves →
 *   speaker view updates without a reload → crew pushes "wrap in 2" → banner →
 *   crew "Bring to stage" → speaker "Go on stage" → on-stage surface → "Send backstage" → gone;
 *   attendees never get a green-room token; sponsor booth reaches the Expo; VIP badge + lounge;
 *   client read-only overview. Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

async function guestPage(browser: Browser, role: "speaker" | "sponsor" | "vip" | "client", eventId: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await grantSpecialGuestAccess(page, role, eventId);
  return { context, page };
}

test("speaker: identity → green room → tech check → cue cards → paste/approve → live cue → bring to stage → go on stage → send backstage", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Green Room ${Date.now()}`);

  // Speaker enters with the speaker code and gives their name once.
  const speaker = await guestPage(browser, "speaker", eventId);
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}`);
  await expect(speaker.page.getByTestId("guest-identity-form")).toHaveAttribute("data-has-identity", "false");
  await expect(speaker.page.locator("body")).toContainText(/Speaker portal/);
  await speaker.page.getByTestId("guest-name").fill("Ada Lovelace");
  await speaker.page.getByTestId("guest-company").fill("Analytical Engines");
  await speaker.page.getByTestId("guest-title").fill("Founder");
  await speaker.page.getByTestId("guest-identity-submit").click();
  await expect(speaker.page.getByTestId("speaker-portal-shell")).toContainText("Ada Lovelace · Analytical Engines · Founder");
  await expect(speaker.page.locator("body")).not.toContainText("speaker-drake");
  await expect(speaker.page.locator("body")).not.toContainText("Drake Speaker");

  // Green room is a real place: backstage, producer notes, run of show, backstage room, cue cards.
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/green-room`);
  await expect(speaker.page.getByTestId("speaker-green-room")).toHaveAttribute("data-stage-status", "backstage");
  await expect(speaker.page.getByTestId("producer-notes-to-speakers")).toBeVisible();
  await expect(speaker.page.getByTestId("speaker-run-of-show")).toBeVisible();
  await expect(speaker.page.getByTestId("guest-room-video-green_room")).toBeVisible();
  await expect(speaker.page.getByTestId("teleprompter-empty")).toBeVisible();

  // Tech check: run the device-free checks and record the outcome.
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/tech-check`);
  await speaker.page.getByRole("button", { name: "Browser + network" }).click();
  await speaker.page.getByTestId("record-tech-check").click();
  await expect(speaker.page.getByTestId("speaker-tech-check-recorded")).toBeVisible();

  // Crew console: the speaker is on the roster with the tech check; write three cue cards and notes.
  const crewContext = await browser.newContext();
  const crew = await crewContext.newPage();
  await grantCrewAccess(crew, "producer", eventId);
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  const row = crew.getByTestId(/^speaker-row-/).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("Ada Lovelace");
  const speakerId = ((await row.getAttribute("data-testid")) || "").replace("speaker-row-", "");
  expect(speakerId).toBeTruthy();
  await expect(crew.getByTestId(`speaker-tech-${speakerId}`)).not.toContainText("not recorded");
  await expect(row).toHaveAttribute("data-stage-status", "backstage");
  await crew.getByTestId(`speaker-cue-editor-${speakerId}`).locator("summary").click();
  await crew.getByTestId(`cue-cards-input-${speakerId}`).fill("Open | Thank the host, 20 seconds\nStory | The night the servers went down\nClose | Invite Q&A");
  await crew.getByTestId(`save-cue-deck-${speakerId}`).click();
  await expect(row).toContainText("v1 live");
  await crew.getByTestId("producer-notes-form").locator('textarea[name="notes"]').fill("Join the green room 15 minutes before your slot.");
  await crew.getByTestId("producer-notes-form").getByRole("button", { name: "Save notes" }).click();

  // Speaker sees the three cards in order on the teleprompter, and the notes in the green room.
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/teleprompter`);
  const prompter = speaker.page.getByTestId("speaker-teleprompter");
  await expect(prompter).toHaveAttribute("data-version", "1");
  await expect(prompter).toHaveAttribute("data-hydrated", "true");
  await expect(speaker.page.getByTestId("teleprompter-card-title")).toHaveText("Open");
  await speaker.page.getByTestId("teleprompter-next").click();
  await expect(speaker.page.getByTestId("teleprompter-card-title")).toHaveText("Story");
  await speaker.page.getByTestId("teleprompter-next").click();
  await expect(speaker.page.getByTestId("teleprompter-card-title")).toHaveText("Close");
  await expect(speaker.page.getByTestId("teleprompter-next")).toBeDisabled();
  await speaker.page.getByTestId("teleprompter-prev").click();
  await expect(speaker.page.getByTestId("teleprompter-card-title")).toHaveText("Story");

  // Speaker pastes their own notes → pending, approved deck unchanged.
  await speaker.page.getByTestId("speaker-cards-input").fill("My opener | Start with the joke\nMy close | Thank the sponsors");
  await speaker.page.getByRole("button", { name: "Queue for producer review" }).click();
  await expect(speaker.page.getByTestId("speaker-cue-submitted")).toBeVisible();
  await expect(speaker.page.getByTestId("speaker-material-review-queue")).toContainText("Queued for producer review");
  await expect(speaker.page.getByTestId("speaker-teleprompter")).toHaveAttribute("data-version", "1");
  await expect(speaker.page.getByTestId("teleprompter-pending-note")).toContainText("Version 2");

  // Crew approves → the speaker's open teleprompter updates by itself (poll ~5s) with the banner.
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  await crew.getByTestId(`speaker-cue-editor-${speakerId}`).locator("summary").click();
  await expect(crew.getByTestId(`speaker-pending-${speakerId}`)).toContainText("My opener");
  await crew.getByTestId(`approve-cue-deck-${speakerId}`).click();
  await expect(crew.getByTestId(`speaker-row-${speakerId}`)).toContainText("v2 live");
  await expect(speaker.page.getByTestId("speaker-teleprompter")).toHaveAttribute("data-version", "2", { timeout: 15_000 });
  await expect(speaker.page.getByTestId("deck-changed-banner")).toContainText("Producer pushed a change");
  await expect(speaker.page.getByTestId("teleprompter-card-title")).toHaveText("My opener");

  // Crew pushes a live cue → banner within ~5s.
  await crew.getByTestId(`speaker-cue-editor-${speakerId}`).locator("summary").click();
  await crew.getByTestId(`live-cue-input-${speakerId}`).fill("wrap in 2 min");
  await crew.getByTestId(`push-live-cue-${speakerId}`).click();
  await expect(speaker.page.getByTestId("live-cue-banner")).toContainText("wrap in 2 min", { timeout: 15_000 });

  // Bring to stage → speaker sees "Go on stage" → on-stage surface; send backstage → gone.
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/backstage`);
  await expect(speaker.page.getByTestId("speaker-on-stage")).toHaveAttribute("data-stage-grant", "backstage");
  await crew.getByTestId(`bring-to-stage-${speakerId}`).click();
  await expect(crew.getByTestId(`speaker-row-${speakerId}`)).toHaveAttribute("data-stage-status", "invited");
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/green-room`);
  await expect(speaker.page.getByTestId("speaker-green-room")).toHaveAttribute("data-stage-status", "invited");
  await speaker.page.getByTestId("go-on-stage").click();
  await expect(speaker.page).toHaveURL(new RegExp(`/speaker/events/${eventId}/backstage`));
  await expect(speaker.page.getByTestId("speaker-on-stage")).toHaveAttribute("data-stage-grant", "on_stage");
  await expect(speaker.page.getByTestId("guest-room-video-main_stage")).toBeVisible();
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  await expect(crew.getByTestId(`speaker-row-${speakerId}`)).toHaveAttribute("data-stage-status", "on_stage");
  await crew.getByTestId(`send-backstage-${speakerId}`).click();
  await expect(crew.getByTestId(`speaker-row-${speakerId}`)).toHaveAttribute("data-stage-status", "backstage");
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/backstage`);
  await expect(speaker.page.getByTestId("speaker-on-stage")).toHaveAttribute("data-stage-grant", "backstage");
  await expect(speaker.page.getByTestId("guest-room-video-main_stage")).toHaveCount(0);

  await speaker.context.close();
  await crewContext.close();
});

test("token grants: a speaker is refused the stage until brought up, and an attendee never gets the green room", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const eventId = await createNowEvent(page, `Grants ${Date.now()}`);

  const speaker = await guestPage(browser, "speaker", eventId);
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}`);
  await speaker.page.getByTestId("guest-name").fill("Grace Hopper");
  await speaker.page.getByTestId("guest-identity-submit").click();
  await expect(speaker.page.getByTestId("speaker-portal-shell")).toContainText("Grace Hopper");
  const stageBefore = await speaker.page.request.post("/api/video/livekit-token", { data: { eventId, roomId: "main-stage", roomType: "main_stage", role: "speaker", displayName: "x" } });
  expect(stageBefore.status()).toBe(403);
  expect((await stageBefore.json()).error).toMatch(/not brought you to the stage/);
  // The green room grant is decided before any provider is touched; a refusal would be 403, anything else means the grant passed.
  const greenRoom = await speaker.page.request.post("/api/video/livekit-token", { data: { eventId, roomId: "green-room", roomType: "green_room", role: "speaker", displayName: "x" } });
  expect(greenRoom.status()).not.toBe(403);

  const attendeeContext = await browser.newContext();
  const attendee = await attendeeContext.newPage();
  await asRegisteredAttendee(attendee, eventId);
  const attendeeGreenRoom = await attendee.request.post("/api/video/livekit-token", { data: { eventId, roomId: "green-room", roomType: "green_room", role: "attendee" } });
  expect(attendeeGreenRoom.status()).toBe(403);
  expect((await attendeeGreenRoom.json()).error).toMatch(/speakers and crew only/);
  await attendee.goto(`/speaker/events/${eventId}/green-room`);
  await expect(attendee).toHaveURL(/\/production-access\/special-guest/);

  await speaker.context.close();
  await attendeeContext.close();
});

test("sponsor booth reaches the Expo; VIP sees the badge and the lounge the crew opens; client gets a read-only overview", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const eventId = await createNowEvent(page, `Guests ${Date.now()}`);

  const sponsor = await guestPage(browser, "sponsor", eventId);
  await gotoAndAssert(sponsor.page, `/sponsor/events/${eventId}`);
  await expect(sponsor.page.locator("body")).toContainText(/Sponsor portal/);
  await sponsor.page.getByTestId("guest-name").fill("Sam Sponsor");
  await sponsor.page.getByTestId("guest-company").fill("Acme Cloud");
  await sponsor.page.getByTestId("guest-identity-submit").click();
  await expect(sponsor.page.getByTestId("sponsor-booth-editor")).toBeVisible();
  await sponsor.page.getByTestId("booth-name").fill("Acme Cloud Booth");
  await sponsor.page.getByTestId("booth-blurb").fill("Cloud for founders who ship.");
  await sponsor.page.getByTestId("booth-link").fill("https://example.com/acme");
  await sponsor.page.getByTestId("save-booth").click();
  await expect(sponsor.page.getByTestId("sponsor-booth-saved")).toContainText("live in the Expo");
  await gotoAndAssert(sponsor.page, `/sponsor/events/${eventId}/leads`);
  await expect(sponsor.page.getByTestId("sponsor-leads")).toContainText("0 attendees opted in");
  await gotoAndAssert(page, `/venue/${eventId}/expo`);
  await expect(page.locator("body")).toContainText("Acme Cloud Booth");
  await sponsor.context.close();

  const vip = await guestPage(browser, "vip", eventId);
  await gotoAndAssert(vip.page, `/venue/${eventId}/lobby`);
  await expect(vip.page.getByTestId("vip-badge")).toBeVisible();
  await expect(vip.page.getByTestId("vip-lounge")).toHaveCount(0);
  await vip.page.getByTestId("guest-name").fill("Val VIP");
  await vip.page.getByTestId("guest-identity-submit").click();
  await expect(vip.page.getByTestId("vip-lobby-panel")).toContainText("Welcome, Val VIP");
  const crewContext = await browser.newContext();
  const crew = await crewContext.newPage();
  await grantCrewAccess(crew, "producer", eventId);
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  await crew.getByTestId("vip-room-toggle").click();
  await expect(crew.getByTestId("vip-room-control")).toHaveAttribute("data-open", "true");
  await gotoAndAssert(vip.page, `/venue/${eventId}/lobby`);
  await expect(vip.page.getByTestId("vip-lounge")).toContainText("Val VIP");
  // A plain visitor never sees the VIP panel.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await gotoAndAssert(visitor, `/venue/${eventId}/lobby`);
  await expect(visitor.getByTestId("vip-lobby-panel")).toHaveCount(0);
  await visitorContext.close();
  await vip.context.close();
  await crewContext.close();

  const client = await guestPage(browser, "client", eventId);
  await gotoAndAssert(client.page, `/client/west-peek/events/${eventId}`);
  await expect(client.page.getByTestId("client-runtime-overview")).toBeVisible();
  await expect(client.page.getByTestId("client-readiness")).toBeVisible();
  await expect(client.page.locator("body")).toContainText(/Client portal/);
  await expect(client.page.locator("body")).not.toContainText("Nova Capital");
  await client.context.close();
});
