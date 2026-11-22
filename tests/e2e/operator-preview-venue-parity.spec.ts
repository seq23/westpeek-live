import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";

const forbidden = /Application error|Internal Server Error|unknown event|forbidden|not authorized|blank/i;

test("seeded phony event exposes complete preview venue surfaces", async ({ page }) => {
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
    await gotoAndAssert(page, route);
    const body = page.locator("body");
    await expect(body).toContainText(/West Peek|Attendee venue|Lobby|Stage|Sessions|Networking|Expo|People|Replay|Help/i);
    await expect(body).not.toContainText(forbidden);
  }
});
