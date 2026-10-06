import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";

test("breakout rooms expose room-scoped live chat and camera controls", async ({ page }) => {
  await gotoAndAssert(page, "/venue/demo/breakouts");
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).toContain("breakout room chat");
  expect(body).toContain("join breakout video");
  expect(body).toContain("this chat is only the people in this breakout. the main stage chat is separate.");
});
