import { expect, test } from "@playwright/test";
import { createPairHistoryRecord, normalizedSpeedNetworkingPairKey, selectNextSpeedNetworkingPair } from "@/services/speed-networking";
import type { SpeedNetworkingEntry, SpeedNetworkingMatch, SpeedNetworkingPairHistory } from "@/types/speedNetworkingEngine";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantAgencySession, grantOperatorAccess, loginAsOperator } from "./helpers/roleJourney";
import { expectEventuallyRuntime, expectEventuallyRuntimeEvent, readRuntimeSnapshot, resetRuntimeTraceFiles } from "./helpers/runtimeTrace";

const unique = Date.now();

const deployedBrowserRun =
  process.env.PLAYWRIGHT_DEPLOYED === "1" ||
  (process.env.PLAYWRIGHT_BASE_URL ? !process.env.PLAYWRIGHT_BASE_URL.includes("127.0.0.1") && !process.env.PLAYWRIGHT_BASE_URL.includes("localhost") : false);

const transactionalDescribe = deployedBrowserRun ? test.describe.skip : test.describe;

transactionalDescribe("Transactional Full Buffett E2E", () => {
  test.beforeEach(() => {
    resetRuntimeTraceFiles();
  });

  test("producer creates a real runtime event row, records a run-of-show action, and opens show-readiness cockpit", async ({ page }) => {
    await loginAsOperator(page, "/app/events/new");

    // The former cookie/file "setup draft" is gone: Create writes one runtime_events row.
    const eventName = `Transactional Buffett Summit ${unique}`;
    await page.getByTestId("when-later").check();
    await page.locator('[name="name"]').fill(eventName);
    await page.locator('[name="clientName"]').fill("West Peek Productions QA");
    await page.locator('[name="eventType"]').selectOption("virtual_summit");
    await page.getByTestId("create-event-submit").click();
    await expect(page).toHaveURL(new RegExp(`/app/events/transactional-buffett-summit-${unique}[a-z0-9-]*\\?created=1`));

    await expectEventuallyRuntimeEvent((events) => events.some((event) => event.name === eventName && event.status === "draft" && /^wpl-/.test(event.joinCode)), "runtime event row should persist to the local runtime store");

    await gotoAndAssert(page, "/app/events/demo/run-of-show");
    await page.getByRole("button", { name: /^Mark live$/i }).click();
    await expectEventuallyRuntime(
      (snapshot) => (snapshot.runOfShowEvents || []).some((event: any) => event.eventId === "demo" && event.action === "mark_live"),
      "producer run-of-show action should persist",
    );

    await loginAsOperator(page, "/admin/testing/demo");
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const term of ["showtime readiness", "livestream", "livekit", "matchmaking", "fallback", "zoom", "google meet", "debug", "fix"]) {
      expect(body).toContain(term);
    }
    await expect(page.getByTestId("showtime-readiness-barometer")).toBeVisible();
    await expect(page.getByTestId("fallback-decision-helper")).toBeVisible();
  });

  test("visitor registration writes a rich local profile, attendee surfaces emit analytics, and help creates support state", async ({ page }) => {
    await gotoAndAssert(page, "/events/demo/register");
    const attendeeName = `Buffett Attendee ${unique}`;
    await page.locator('[name="name"]').fill(attendeeName);
    await page.locator('[name="email"]').fill(`buffett-${unique}@example.com`);
    await page.locator('[name="company"]').fill("West Peek QA Ventures");
    await page.locator('[name="title"]').fill("Show Readiness Operator");
    await page.getByRole("button", { name: /submit registration/i }).click();
    await expect(page).toHaveURL(/\/venue\/event-summit\/lobby\?registered=1/);
    // The rich profile fields are added from "Tell us more" inside the venue, through the one profile write path.
    const card = page.getByTestId("attendee-profile-panel");
    await card.locator("summary").click();
    await card.getByTestId("tell-website").fill("https://westpeek.live");
    await card.getByTestId("tell-social").fill("https://linkedin.com/in/westpeekqa");
    await card.getByTestId("tell-reason").fill("Validate the event venue transactionally before deployment.");
    await card.getByTestId("tell-fact").fill("I test the system like a producer on show day.");
    await card.getByTestId("tell-us-more-save").click();
    await expect(page).toHaveURL(/saved=profile/);

    await expectEventuallyRuntime(
      (snapshot) => (snapshot.registrations || []).some((registration: any) => registration.displayName === attendeeName && registration.company === "West Peek QA Ventures"),
      "registration should persist rich attendee profile",
    );

    await gotoAndAssert(page, "/venue/event-summit/stage");
    await expectEventuallyRuntime(
      (snapshot) => (snapshot.analyticsEvents || []).some((event: any) => event.kind === "attendee_joined_session" && event.eventId === "event-summit"),
      "stage visit should record attendee session analytics",
    );

    await gotoAndAssert(page, "/venue/event-summit/help");
    await page.locator('[name="subject"]').fill(`Transactional support request ${unique}`);
    await page.locator('[name="message"]').fill("Need help validating fallback rooms before showtime.");
    await page.getByRole("button", { name: /send help request/i }).click();
    await expectEventuallyRuntime(
      (snapshot) => (snapshot.supportRequests || []).some((request: any) => String(request.subject).includes(`Transactional support request ${unique}`)),
      "help request should persist support state",
    );
  });

  test("attendee networking join writes queue analytics and matching engine proves match/no-repeat/exhaustion semantics", async ({ page }) => {
    await asRegisteredAttendee(page, "event-summit");
    await gotoAndAssert(page, "/venue/event-summit/networking");
    // The networking gate asks for topics inline when the profile has none.
    const gate = page.getByTestId("networking-topics-gate");
    if (await gate.count()) await gate.getByTestId("networking-topics-input").fill("AI, fundraising");
    await page.getByRole("button", { name: /join queue/i }).click();
    await expect(page).toHaveURL(/\/venue\/event-summit\/networking\?state=waiting&queued=1/);
    await expectEventuallyRuntime(
      (snapshot) => (snapshot.analyticsEvents || []).some((event: any) => event.kind === "networking_joined" && event.metadata?.queueState === "waiting"),
      "networking join should record queue analytics",
    );

    const entries: SpeedNetworkingEntry[] = [
      { id: "entry-a", attendeeId: "attendee-a", agencyId: "agency-1", eventId: "event-summit", queueId: "queue-1", displayName: "A", status: "waiting", joinedQueueAt: "2026-01-01T00:00:00.000Z" },
      { id: "entry-b", attendeeId: "attendee-b", agencyId: "agency-1", eventId: "event-summit", queueId: "queue-1", displayName: "B", status: "waiting", joinedQueueAt: "2026-01-01T00:01:00.000Z" },
      { id: "entry-c", attendeeId: "attendee-c", agencyId: "agency-1", eventId: "event-summit", queueId: "queue-1", displayName: "C", status: "waiting", joinedQueueAt: "2026-01-01T00:02:00.000Z" },
    ];
    const firstPair = selectNextSpeedNetworkingPair(entries);
    expect(firstPair?.map((entry) => entry.attendeeId)).toEqual(["attendee-a", "attendee-b"]);

    const match: SpeedNetworkingMatch = {
      id: "match-ab",
      agencyId: "agency-1",
      eventId: "event-summit",
      queueId: "queue-1",
      participantAEntryId: "entry-a",
      participantBEntryId: "entry-b",
      normalizedPairKey: normalizedSpeedNetworkingPairKey("event-summit", entries[0], entries[1]),
      status: "active",
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:03:00.000Z",
    };
    const history: SpeedNetworkingPairHistory[] = [createPairHistoryRecord(match, entries[0], entries[1])];
    const secondPair = selectNextSpeedNetworkingPair(entries, [], history);
    expect(secondPair?.map((entry) => entry.attendeeId)).toEqual(["attendee-a", "attendee-c"]);

    const exhausted: SpeedNetworkingPairHistory[] = [
      ...history,
      { eventId: "event-summit", normalizedPairKey: normalizedSpeedNetworkingPairKey("event-summit", entries[0], entries[2]), attendeeAId: "attendee-a", attendeeBId: "attendee-c", firstMatchedAt: "2026-01-01T00:03:00.000Z", matchId: "match-ac" },
      { eventId: "event-summit", normalizedPairKey: normalizedSpeedNetworkingPairKey("event-summit", entries[1], entries[2]), attendeeAId: "attendee-b", attendeeBId: "attendee-c", firstMatchedAt: "2026-01-01T00:06:00.000Z", matchId: "match-bc" },
    ];
    expect(selectNextSpeedNetworkingPair(entries, [], exhausted)).toBeNull();
  });

  test("video provider token endpoints fail safely without secrets and preserve operator fallback decisioning", async ({ request, page }) => {
    const payload = {
      eventId: "event-summit",
      roomId: "event-summit-main-stage",
      roomType: "main_stage",
      displayName: "Transactional Video Tester",
      role: "producer",
    };
    for (const route of ["/api/video/livekit-token", "/api/video/daily-token", "/api/video/zoom-signature"]) {
      const response = await request.post(route, { data: payload });
      expect(response.status(), `${route} should fail safely or succeed with provider-shaped response`).toBeLessThan(503);
      const text = await response.text();
      expect(text).not.toContain("Internal Server Error");
      expect(text).not.toContain("__next_error__");
      expect(text).not.toMatch(/digest\s*[:=]/i);
    }

    await loginAsOperator(page, "/admin/testing/demo");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).toContain("livekit");
    expect(body).toContain("daily");
    expect(body).toContain("zoom");
    expect(body).toContain("google meet");
    expect(body).toContain("switch");
  });
});
