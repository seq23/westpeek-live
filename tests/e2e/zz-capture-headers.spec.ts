import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { loginAsOperator } from "./helpers/roleJourney";
import { asRegisteredAttendee } from "./helpers/persona";

// Temporary (tmp/capture-headers): the key pages at 390 px with HSTS + the page-wide CSP; any console error (a CSP refusal is one) fails.
test.use({ viewport: { width: 390, height: 844 } });
const errors: string[] = [];
function watch(page: Page, who: string) {
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${who} ${page.url()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${who} ${page.url()}: ${e.message}`));
}
async function visit(page: Page, who: string, path: string, name: string) {
  const response = await page.goto(path);
  const headers = response?.headers() || {};
  console.log(`HEADERS ${name} ${path} status=${response?.status()} hsts=${headers["strict-transport-security"]} csp=${headers["content-security-policy"]}`);
  expect(headers["strict-transport-security"], path).toMatch(/max-age=31536000/);
  expect(headers["content-security-policy"], path).toContain("frame-ancestors 'self'");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  console.log(`CAPTURE ${name} scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}`);
  console.log(`WIDE ${name} ${await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`).join(" | "))}`);
  await page.screenshot({ path: `capture/${name}.png` });
}

test("key pages carry the headers and nothing on them is refused", async ({ page, browser }) => {
  test.setTimeout(300_000);
  watch(page, "operator");
  for (const [path, name] of [["/", "home"], ["/login", "login"], ["/production-access/crew", "crew-gate"], ["/production-access/special-guest", "guest-gate"]]) await visit(page, "anon", path, name);
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(`Headers ${Date.now()}`);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  const eventId = new URL(page.url()).pathname.split("/")[2];
  for (const [path, name] of [[`/app/events/${eventId}`, "workspace-event"], [`/app/events/${eventId}/assets`, "assets"], [`/app/events/${eventId}/access`, "access"], [`/venue/${eventId}/lobby`, "lobby-producer"], [`/venue/${eventId}/stage`, "stage-producer"], ["/manual", "manual"]]) await visit(page, "operator", path, name);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const attendee = await context.newPage();
  watch(attendee, "attendee");
  await asRegisteredAttendee(attendee, eventId);
  for (const [path, name] of [[`/venue/${eventId}/lobby`, "lobby-attendee"], [`/venue/${eventId}/stage`, "stage-attendee"], [`/venue/${eventId}/networking`, "networking-attendee"]]) await visit(attendee, "attendee", path, name);
  await gotoAndAssert(attendee, `/venue/${eventId}/lobby`);
  console.log(`CAPTURE console errors: ${errors.length}`);
  for (const line of errors) console.log(`CONSOLE ${line}`);
  expect(errors.filter((line) => /Content Security Policy|Refused to/i.test(line))).toEqual([]);
});
