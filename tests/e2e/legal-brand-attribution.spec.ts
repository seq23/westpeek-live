import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { day1Passwords } from "./helpers/day1AccessDefaults";

test("privacy and terms pages expose approved legal/support contact model", async ({ page }) => {
  await gotoAndAssert(page, "/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("West Peek Productions LLC");
  await expect(page.locator("body")).toContainText("info@westpeek.ventures");

  await gotoAndAssert(page, "/terms");
  await expect(page.getByRole("heading", { name: "Terms of Use", exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("West Peek Productions LLC");
  await expect(page.locator("body")).toContainText("info@westpeek.ventures");
});

test("legal footer uses product, producer, privacy, terms, and email support destinations", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/operator");

  // The footer carries the attribution links; the brand mark at the top is its own home link
  // ("West Peek Live home page", 17 Sep 2026), so the footer is where these are asserted.
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: /West Peek Live/i })).toHaveAttribute("href", "https://westpeek.live");
  await expect(footer.getByRole("link", { name: /West Peek Productions/i })).toHaveAttribute("href", "https://productions.joinwestpeek.com/");
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await expect(footer.getByRole("link", { name: "Support" })).toHaveAttribute("href", "mailto:info@westpeek.ventures");
  await expect(page.getByRole("link", { name: "West Peek Live home page" })).toHaveAttribute("href", "https://westpeek.live");

  const body = await page.locator("body").innerText();
  for (const password of day1Passwords) expect(body).not.toContain(password);
});

test("event registration exposes legal/support links without exposing Day 1 passwords", async ({ page }) => {
  await gotoAndAssert(page, "/events/demo/register");
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Support" })).toHaveAttribute("href", "mailto:info@westpeek.ventures");

  const body = await page.locator("body").innerText();
  for (const password of day1Passwords) expect(body).not.toContain(password);
});
