import { expect, test } from "@playwright/test";
import { expectRouteMatrix, expectVisibleRoute } from "./helpers/roleJourney";

test("attendee can move through the complete virtual venue without dead ends", async ({ page }) => {
  await expectRouteMatrix(page, [
    { path: "/venue/demo/lobby", label: "attendee lobby", terms: ["lobby"], anyOf: ["stage", "sessions", "networking"] },
    { path: "/venue/demo/stage", label: "main stage", terms: ["stage"], anyOf: ["live chat", "run of show", "help"] },
    { path: "/venue/demo/run-of-show", label: "attendee run of show", terms: ["run of show"], anyOf: ["opening", "backup", "daily"] },
    { path: "/venue/demo/sessions", label: "sessions", terms: ["sessions"], anyOf: ["founder", "session"] },
    { path: "/venue/demo/sessions/session-main", label: "session detail", anyOf: ["session", "founder", "room"] },
    { path: "/venue/demo/breakouts", label: "breakouts", anyOf: ["breakout", "session", "room"] },
    { path: "/venue/demo/expo", label: "expo", anyOf: ["expo", "sponsor", "booth"] },
    { path: "/venue/demo/expo/booth-clarity", label: "sponsor booth", anyOf: ["clarity", "booth", "sponsor"] },
    { path: "/venue/demo/networking", label: "networking", terms: ["network", "queue"], anyOf: ["match", "matching", "timer"] },
    { path: "/venue/demo/people", label: "people", anyOf: ["people", "attendee", "profile"] },
    { path: "/venue/demo/replay", label: "replay", anyOf: ["replay", "recording", "session"] },
    { path: "/venue/demo/help", label: "help", anyOf: ["help", "support", "issue"] },
  ]);
});

test("main stage exposes live-stream, chat, run-of-show, and fallback/support affordances", async ({ page }) => {
  await expectVisibleRoute(page, { path: "/venue/demo/stage", label: "main stage", terms: ["stage"] });
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const term of ["live", "chat", "run of show", "help"]) {
    expect(body).toContain(term);
  }
  // The fallback affordance an attendee sees is the promise that a source switch fixes itself;
  // the provider names stay behind the scenes (16 Sep 2026).
  expect(body).toContain("if the picture refreshes or switches source behind the scenes, stay on this page. it comes back on its own.");
});
