import { createHmac } from "crypto";
import fs from "fs";
import path from "path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

test.setTimeout(300_000);

const forbidden = /Application error|Internal Server Error|__next_error__|digest|unknown event|missing setup|Supabase Auth required|admin account required|not authorized|forbidden|operator required|special guest password|TODO|placeholder|lorem ipsum|coming soon|undefined|null|\[object Object\]/i;

async function assertUsefulPage(page: Page, expected: RegExp) {
  const body = page.locator("body");
  await expect(body).toContainText(expected);
  await expect(body).not.toContainText(forbidden);
}

async function isolatedPage(context: BrowserContext) {
  return context.newPage();
}

async function loginOperator(page: Page) {
  await gotoAndAssert(page, "/production-access/operator");
  await page.getByLabel(/operator launchpad password/i).fill(process.env.E2E_OPERATOR_PASSWORD || process.env.OPERATOR_LAUNCHPAD_PASSWORD || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
  await page.getByRole("button", { name: /enter operator launchpad/i }).click();
  await expect(page).toHaveURL(/\/production-access\/launchpad/);
  await assertUsefulPage(page, /Operator Launchpad/i);
}

async function loginOwner(page: Page) {
  await gotoAndAssert(page, "/production-access/owner");
  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(page).toHaveURL(/\/app/);
  await assertUsefulPage(page, /Dashboard|Agency|Events|West Peek|Event/i);
}

async function loginCrew(page: Page, eventCode = "demo", expectedEventPattern: RegExp = /\/crew\/events\/(demo|event-summit)/) {
  await gotoAndAssert(page, "/production-access/crew");
  await page.getByLabel(/crew password/i).fill(process.env.E2E_CREW_PASSWORD || process.env.CREW_ACCESS_PASSWORD || requiredDay1Default("CREW_ACCESS_PASSWORD"));
  await page.getByLabel(/event code/i).fill(eventCode);
  await page.getByLabel(/production role/i).selectOption("crew");
  await page.getByRole("button", { name: /enter crew workspace/i }).click();
  await expect(page).toHaveURL(expectedEventPattern);
  await assertUsefulPage(page, /Crew show-day command|Crew Briefing/i);
}

async function loginSpecialGuest(page: Page, role: "client" | "speaker" | "sponsor" | "crew_lite" | "vip", code: string, expectedUrl: RegExp, expectedText: RegExp, eventCode = "demo") {
  expect(code, `${role} code must be present for special guest gauntlet`).toBeTruthy();

  await gotoAndAssert(page, "/production-access/special-guest");
  await page.getByLabel(/event code/i).fill(eventCode);
  await page.getByLabel(/special guest password/i).fill(code || "");
  await page.getByRole("button", { name: /continue to assigned portal/i }).click();

  await expect(page, role).toHaveURL(expectedUrl);
  await assertUsefulPage(page, expectedText);
}


function readLocalEnvValue(key: string) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

function liveKitWebhookSignature(body: string) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET || readLocalEnvValue("LIVEKIT_WEBHOOK_SECRET") || requiredDay1Default("LIVEKIT_WEBHOOK_SECRET");
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function postStageSignal(page: Page, signal: string, reason: string, eventId = "event-summit") {
  const response = await page.request.post("/api/video/stage-stream-fallback", {
    data: { eventId, stageId: "main-stage", signal, reason },
  });
  expect(response.ok(), `${signal} stage fallback API should succeed`).toBeTruthy();
  const json = await response.json();
  expect(json.ok).toBeTruthy();
  return json.state;
}

async function postLiveKitWebhook(page: Page, event: "ingress_started" | "ingress_ended", eventId = "event-summit") {
  const body = JSON.stringify({ event, eventId, stageId: "main-stage", ingressInfo: { roomName: `${eventId}-main-stage` } });
  const response = await page.request.post("/api/video/livekit-webhook", {
    headers: { "x-livekit-signature": liveKitWebhookSignature(body), "content-type": "application/json" },
    data: Buffer.from(body, "utf8"),
  });
  expect(response.ok(), `${event} webhook should be accepted with signed local HMAC`).toBeTruthy();
  const json = await response.json();
  expect(json.ok).toBeTruthy();
  return json.state;
}

async function assertPublicRoutesDoNotExposeStreamYardSecrets(page: Page, eventId = "demo") {
  for (const route of ["/", `/events/${eventId}`, `/venue/${eventId}/lobby`, `/venue/${eventId}/stage`]) {
    await gotoAndAssert(page, route);
    const body = page.locator("body");
    await expect(body).not.toContainText(/livekitStreamKey|Click to Copy Stream Key|RTMP URL|Stream Key/i);
  }
}

async function assertCannotAccess(page: Page, route: string, expectedGate: RegExp) {
  await gotoAndAssert(page, route);
  await expect(page).toHaveURL(expectedGate);
  await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|__next_error__|digest/i);
}

test("Day 1 showtime master gauntlet proves role journeys, transactions, outcomes, and boundaries", async ({ browser }) => {
  const attendeeContext = await browser.newContext();
  const attendee = await isolatedPage(attendeeContext);

  await gotoAndAssert(attendee, "/");
  await assertUsefulPage(attendee, /Join an Event|West Peek Live|Plan an Event/i);

  await gotoAndAssert(attendee, "/events/demo");
  await assertUsefulPage(attendee, /Register|Preview venue|Agenda preview|Speakers|Sponsors/i);

  await attendee.getByRole("link", { name: /register/i }).first().click();
  await expect(attendee).toHaveURL(/\/events\/demo\/register/);
  await assertUsefulPage(attendee, /Registration|attendee identity|does not grant speaker, sponsor, client, crew, operator, admin, VIP/i);

  await attendee.getByLabel(/^Name/i).fill("Playwright Attendee");
  await attendee.getByLabel(/^Email/i).fill("playwright-attendee@example.com");
  await attendee.getByLabel(/Company \/ affiliation/i).fill("West Peek QA");
  await attendee.getByLabel(/Title \/ role/i).fill("Hostile Client Reviewer");
  await attendee.getByRole("button", { name: /submit registration/i }).click();

  await expect(attendee).toHaveURL(/\/venue\/(demo|event-summit)\/lobby/);
  await assertUsefulPage(attendee, /Lobby|Attendee venue|West Peek/i);
  await attendee.reload();
  await assertUsefulPage(attendee, /Lobby|Attendee venue|West Peek/i);

  for (const route of [
    "/venue/demo/lobby",
    "/venue/demo/stage",
    "/venue/demo/sessions",
    "/venue/demo/breakouts",
    "/venue/demo/networking",
    "/venue/demo/expo",
    "/venue/demo/people",
    "/venue/demo/replay",
    "/venue/demo/help",
  ]) {
    await gotoAndAssert(attendee, route);
    await assertUsefulPage(attendee, /West Peek|Attendee venue|Lobby|Stage|Sessions|Networking|Expo|People|Replay|Help|Breakouts/i);
  }

  await assertCannotAccess(attendee, "/production-access/launchpad", /\/production-access\/operator/);
  await assertCannotAccess(attendee, "/app/events/new", /\/production-access\/operator/);
  await assertCannotAccess(attendee, "/crew/events/event-summit", /\/production-access\/crew/);
  await assertCannotAccess(attendee, "/speaker/events/event-summit", /\/production-access\/special-guest/);
  await assertCannotAccess(attendee, "/sponsor/events/event-summit", /\/production-access\/special-guest/);
  await assertCannotAccess(attendee, "/client/client/events/event-summit", /\/production-access\/special-guest/);
  await attendeeContext.close();

  const ownerContext = await browser.newContext();
  const owner = await isolatedPage(ownerContext);
  await loginOwner(owner);
  for (const route of ["/app", "/app/settings", "/app/events", "/app/events/new", "/billing", "/admin/testing", "/admin/testing/event-summit"]) {
    await gotoAndAssert(owner, route);
    await expect(owner.locator("body")).not.toContainText(forbidden);
  }
  await ownerContext.close();

  const operatorContext = await browser.newContext();
  const operator = await isolatedPage(operatorContext);
  await loginOperator(operator);
  // The slug is derived from the name by the repository; read it back from the URL after creation.
  let createdEventSlug = "playwright-day-1-showtime-master-event";
  let createdEventUrl = new RegExp(`/events/${createdEventSlug}`);
  let createdVenueUrl = new RegExp(`/venue/${createdEventSlug}/lobby`);

  const launchpad = operator.locator("body");
  await expect(launchpad).toContainText(/Create Event in Admin Workspace/i);
  await expect(launchpad).toContainText(/Preview Demo Venue/i);
  await expect(launchpad).toContainText(/Crew Briefing & Instructions/i);
  await expect(launchpad).toContainText(/Run of Show/i);
  await expect(launchpad).toContainText(/Video Health/i);
  await expect(launchpad).toContainText(/Crew Gate|Test Crew Login/i);
  await expect(launchpad).not.toContainText(/Coming soon|TODO|placeholder|lorem ipsum/i);

  await operator.getByRole("link", { name: /Create Event in Admin Workspace/i }).first().click();
  await expect(operator).toHaveURL(/\/app\/events\/new/);
  await assertUsefulPage(operator, /Start a Room now, or plan an event for later/i);
  await expect(operator.locator("body")).toContainText(/Basics.*Branding.*Attendee Flow.*Venue.*Agenda.*Access.*Communications.*Preview.*Publish/i);
  // The Day 1 video model is a default of every event, not a per-event form field.
  await expect(operator.locator("body")).toContainText(/Production feed \/ source: StreamYard/i);
  await expect(operator.locator("body")).toContainText(/Primary embedded distribution: LiveKit/i);
  await expect(operator.locator("body")).toContainText(/Cloudflare Stream, then Daily, then Zoom \+ Google Meet/i);

  await operator.getByTestId("when-later").check();
  await operator.getByLabel(/^Event name/i).fill("Playwright Day 1 Showtime Master Event");
  await operator.getByLabel(/New client name/i).fill("West Peek Productions");
  await operator.getByLabel(/^Type/i).selectOption("virtual_summit");
  await operator.getByTestId("create-event-submit").click();

  await expect(operator).toHaveURL(/\/app\/events\/playwright-day-1-showtime-master-event[a-z0-9-]*\?created=1/);
  createdEventSlug = new URL(operator.url()).pathname.split("/")[3];
  createdEventUrl = new RegExp(`/events/${createdEventSlug}`);
  createdVenueUrl = new RegExp(`/venue/${createdEventSlug}/lobby`);
  await expect(operator.getByTestId("runtime-event-header")).toBeVisible();
  await expect(operator.locator("body")).toContainText("Playwright Day 1 Showtime Master Event");
  // Publish: the draft becomes registration_open on the row itself — no PR, no redeploy.
  await operator.getByTestId("publish-event").click();
  await expect(operator).toHaveURL(new RegExp(`/app/events/${createdEventSlug}/publish\\?updated=registration_open`));

  const setupUrl = `/app/events/${createdEventSlug}/setup`;
  await gotoAndAssert(operator, setupUrl);
  await expect(operator.getByTestId("event-setup-draft-summary")).toBeVisible();
  await gotoAndAssert(operator, `/app/events/${createdEventSlug}/access`);
  const generatedCodes = {
    client: (await operator.getByTestId("generated-client-code").innerText()).trim(),
    speaker: (await operator.getByTestId("generated-speaker-code").innerText()).trim(),
    sponsor: (await operator.getByTestId("generated-sponsor-code").innerText()).trim(),
    vip: (await operator.getByTestId("generated-vip-code").innerText()).trim(),
    crew_lite: (await operator.getByTestId("generated-crew-lite-code").innerText()).trim(),
  };
  expect(generatedCodes.speaker).toMatch(/^SPK-[A-Z0-9]{6}$/);
  expect(new Set(Object.values(generatedCodes)).size).toBe(5);

  await gotoAndAssert(operator, `/events/${createdEventSlug}`);
  await expect(operator).toHaveURL(createdEventUrl);
  await assertUsefulPage(operator, /Playwright Day 1 Showtime Master Event|Register|Preview venue|Agenda preview|Speakers|Sponsors/i);
  await gotoAndAssert(operator, `/events/${createdEventSlug}/register`);
  await assertUsefulPage(operator, /Registration|attendee identity|Playwright Day 1 Showtime Master Event/i);
  await operator.getByLabel(/^Name/i).fill("Playwright Created Event Attendee");
  await operator.getByLabel(/^Email/i).fill("playwright-created-event-attendee@example.com");
  await operator.getByLabel(/Company \/ affiliation/i).fill("West Peek QA");
  await operator.getByLabel(/Title \/ role/i).fill("Hostile Client Reviewer");
  await operator.getByRole("button", { name: /submit registration/i }).click();
  await expect(operator).toHaveURL(createdVenueUrl);
  await assertUsefulPage(operator, /Lobby|Attendee venue|West Peek/i);

  await operator.goto(setupUrl);
  await expect(operator.getByTestId("event-scoped-day1-command-links")).toContainText(/Event-scoped command links/i);

  await operator.getByTestId("event-scoped-day1-command-links").getByRole("link", { name: /Run of Show/i }).click();
  await expect(operator).toHaveURL(new RegExp(`/app/events/${createdEventSlug}/run-of-show`));
  await assertUsefulPage(operator, /Run of Show|Agenda|Stage/i);

  await operator.goto(setupUrl);
  await operator.getByTestId("event-scoped-day1-command-links").getByRole("link", { name: /Crew Briefing & Instructions/i }).click();
  await expect(operator).toHaveURL(new RegExp(`/app/events/${createdEventSlug}/crew`));
  await assertUsefulPage(operator, /Publish crew instructions for show day|Crew Briefing/i);
  await expect(operator.locator("body")).toContainText(/call sheet|run of show|task list|fallback|escalation/i);

  await operator.goto(setupUrl);
  await operator.getByTestId("event-scoped-day1-command-links").getByRole("link", { name: /Role Access & Codes/i }).click();
  await expect(operator).toHaveURL(new RegExp(`/app/events/${createdEventSlug}/access`));
  await assertUsefulPage(operator, /Access|role|code|speaker|sponsor|client|VIP|crew/i);

  await operator.goto(setupUrl);
  await operator.getByTestId("event-scoped-day1-command-links").getByRole("link", { name: /Producer Approval Queue/i }).click();
  await expect(operator).toHaveURL(new RegExp(`/app/events/${createdEventSlug}/approval-queue`));
  await assertUsefulPage(operator, /Approval|Producer|Queue|speaker material/i);

  await operator.goto(setupUrl);
  await operator.getByTestId("event-scoped-day1-command-links").getByRole("link", { name: /Testing Console/i }).click();
  await expect(operator).toHaveURL(new RegExp(`/admin/testing/${createdEventSlug}`));
  await expect(operator.locator("body")).toContainText(/StreamYard|ingress|LiveKit|Daily|fallback/i);
  await expect(operator.locator("body")).toContainText(/Click to Copy RTMP URL|Click to Copy Stream Key|Failure plane|keep StreamYard running|Switch attendees to Daily/i);

  // App-controlled StreamYard → LiveKit integration proof. This proves protected controls, signed/simulated webhook semantics,
  // Daily fallback transition, failure-plane separation, and public non-exposure. It does not prove real media packets flowed
  // from StreamYard unless the separate STREAMYARD_REAL_PROVIDER_SMOKE lane is run with a real broadcast.
  await assertPublicRoutesDoNotExposeStreamYardSecrets(operator, createdEventSlug);
  await gotoAndAssert(operator, `/admin/testing/${createdEventSlug}`);

  const liveState = await postLiveKitWebhook(operator, "ingress_started", createdEventSlug);
  expect(liveState.streamStatus).toBe("LIVEKIT_INGRESS_LIVE");
  expect(liveState.activeStreamSource).toBe("LIVEKIT_INGRESS");
  expect(liveState.producerStudioSource).toBe("STREAMYARD");

  const streamyardLoss = await postLiveKitWebhook(operator, "ingress_ended", createdEventSlug);
  expect(streamyardLoss.failurePlane).toBe("STREAMYARD_FEED");
  expect(streamyardLoss.activeStreamSource).toBe("DAILY");
  expect(streamyardLoss.producerStudioSource).toBe("STREAMYARD");

  const liveKitDistributionLoss = await postStageSignal(operator, "livekit_room_unreachable", "Playwright simulated LiveKit distribution loss.", createdEventSlug);
  expect(liveKitDistributionLoss.failurePlane).toBe("LIVEKIT_DISTRIBUTION");
  expect(liveKitDistributionLoss.producerStudioSource).toBe("STREAMYARD");
  expect(liveKitDistributionLoss.fallbackRecommendation).toMatch(/keep StreamYard running/i);

  const dailyFallback = await postStageSignal(operator, "manual_switch_to_daily", "Playwright simulated operator Daily fallback.", createdEventSlug);
  expect(dailyFallback.streamStatus).toBe("DAILY_LIVE");
  expect(dailyFallback.activeStreamSource).toBe("DAILY");
  expect(dailyFallback.producerStudioSource).toBe("STREAMYARD");

  for (const route of [`/app/events/${createdEventSlug}/video-health`, `/app/events/${createdEventSlug}/run-of-show`, `/app/events/${createdEventSlug}/preview`]) {
    await gotoAndAssert(operator, route);
    await expect(operator.locator("body")).not.toContainText(forbidden);
  }

  await assertCannotAccess(operator, "/app/settings", /\/production-access\/owner/);
  await assertCannotAccess(operator, "/billing", /\/production-access\/owner/);
  await operatorContext.close();

  const crewContext = await browser.newContext();
  const crew = await isolatedPage(crewContext);
  await loginCrew(crew, createdEventSlug, new RegExp(`/crew/events/${createdEventSlug}`));
  for (const route of [
    `/crew/events/${createdEventSlug}`,
    `/crew/events/${createdEventSlug}/call-sheet`,
    `/crew/events/${createdEventSlug}/run-of-show`,
    `/crew/events/${createdEventSlug}/tasks`,
  ]) {
    await gotoAndAssert(crew, route);
    await assertUsefulPage(crew, /Crew|Call Sheet|Run of Show|Tasks|Escalation/i);
  }
  await assertCannotAccess(crew, "/production-access/launchpad", /\/production-access\/operator/);
  await assertCannotAccess(crew, "/app/events/new", /\/production-access\/operator/);
  await assertCannotAccess(crew, "/app/settings", /\/production-access\/owner/);
  await crewContext.close();

  const roleCases = [
    {
      role: "speaker",
      code: generatedCodes.speaker,
      url: new RegExp(`/speaker/events/${createdEventSlug}`),
      text: /Speaker portal|onboarding checklist|bio|headshot|deck|tech check/i,
      denied: [`/sponsor/events/${createdEventSlug}`, `/client/west-peek-productions/events/${createdEventSlug}`, "/app/events/new", `/crew/events/${createdEventSlug}`],
    },
    {
      role: "sponsor",
      code: generatedCodes.sponsor,
      url: new RegExp(`/sponsor/events/${createdEventSlug}`),
      text: /Sponsor portal|Booth setup|lead report|Logo|CTA|Lead routing/i,
      denied: [`/speaker/events/${createdEventSlug}`, `/client/west-peek-productions/events/${createdEventSlug}`, "/app/events/new", `/crew/events/${createdEventSlug}`],
    },
    {
      role: "client",
      code: generatedCodes.client,
      url: new RegExp(`/client/[^/]+/events/${createdEventSlug}`),
      text: /Client portal|event progress|approvals|assets|reports|Your events/i,
      denied: [`/speaker/events/${createdEventSlug}`, `/sponsor/events/${createdEventSlug}`, "/app/events/new", `/crew/events/${createdEventSlug}`],
    },
    {
      role: "vip",
      code: generatedCodes.vip,
      url: new RegExp(`/venue/${createdEventSlug}/lobby`),
      text: /Lobby|Attendee venue|West Peek/i,
      denied: [`/speaker/events/${createdEventSlug}`, `/sponsor/events/${createdEventSlug}`, `/client/west-peek-productions/events/${createdEventSlug}`, "/app/events/new", `/crew/events/${createdEventSlug}`],
    },
    {
      role: "crew_lite",
      code: generatedCodes.crew_lite,
      url: new RegExp(`/crew/events/${createdEventSlug}`),
      text: /Crew show-day command|Crew Briefing/i,
      denied: [`/speaker/events/${createdEventSlug}`, `/sponsor/events/${createdEventSlug}`, `/client/west-peek-productions/events/${createdEventSlug}`, "/app/events/new", "/production-access/launchpad"],
    },
  ] as const;

  for (const roleCase of roleCases) {
    const context = await browser.newContext();
    const page = await isolatedPage(context);
    await loginSpecialGuest(page, roleCase.role, roleCase.code, roleCase.url, roleCase.text, createdEventSlug);

    if (roleCase.role === "speaker") {
      await gotoAndAssert(page, `/speaker/events/${createdEventSlug}/teleprompter`);
      await assertUsefulPage(page, /Teleprompter|Speaker materials|producer review queue/i);
      await expect(page.getByTestId("speaker-material-submission-panel")).toBeVisible();
      await page.getByLabel(/Material type/i).selectOption("teleprompter_note");
      await page.getByLabel(/^Title/i).fill("Playwright keynote timing note");
      await page.getByLabel(/Notes for producer/i).fill("Please add the sponsor-safe transition before the Q&A handoff.");
      await page.getByLabel(/Link to deck or document/i).fill("https://example.com/playwright-speaker-deck.pdf");
      await page.getByRole("button", { name: /Queue for producer review/i }).click();
      await expect(page.getByTestId("speaker-material-review-queue")).toContainText(/Queued for producer review/i);
      await expect(page.getByTestId("speaker-material-review-queue")).toContainText(/Playwright keynote timing note/i);
    }

    for (const deniedRoute of roleCase.denied) {
      const expectedGate = deniedRoute.startsWith("/app") || deniedRoute === "/production-access/launchpad"
        ? /\/production-access\/operator/
        : deniedRoute.startsWith("/crew")
          ? /\/production-access\/crew/
          : /\/production-access\/special-guest/;
      await assertCannotAccess(page, deniedRoute, expectedGate);
    }

    await assertCannotAccess(page, "/app/settings", /\/production-access\/owner/);
    await assertCannotAccess(page, "/billing", /\/production-access\/owner/);
    await context.close();
  }

  const producerReviewContext = await browser.newContext();
  const producerReview = await isolatedPage(producerReviewContext);
  await loginOperator(producerReview);
  await gotoAndAssert(producerReview, `/app/events/${createdEventSlug}/approval-queue`);
  await assertUsefulPage(producerReview, /Approvals, blockers, and final locks|Approval items/i);
  // Runtime events: what the speaker pastes waits on the crew deck's speaker row (the approval queue points there).
  await expect(producerReview.locator("body")).toContainText(/waits there for your approval/i);
  await gotoAndAssert(producerReview, `/crew/events/${createdEventSlug}`);
  const pendingCue = producerReview.getByTestId(/^speaker-pending-/).first();
  await expect(pendingCue).toContainText(/Playwright keynote timing note/i);
  await expect(pendingCue).toContainText(/sponsor-safe transition/i);
  await producerReviewContext.close();
});
