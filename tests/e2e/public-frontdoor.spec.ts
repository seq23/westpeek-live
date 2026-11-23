import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";

test("public homepage CTAs resolve to usable first-party routes", async ({ page }) => {
  await gotoAndAssert(page, "/");
  await expect(page.getByRole("link", { name: /join an event/i })).toHaveAttribute("href", "/join");
  await expect(page.getByRole("link", { name: /production access/i })).toHaveAttribute("href", "/production-access");
  await expect(page.getByRole("link", { name: /preview demo venue/i })).toHaveAttribute("href", "/venue/demo/lobby");
});

test("public entry routes do not crash", async ({ page }) => {
  for (const route of ["/join", "/production-access", "/events/demo", "/venue/demo/lobby"]) {
    await gotoAndAssert(page, route);
  }
});
