import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * People who registered before 16 Sep 2026 (email stored only as a hash): /app/people lists them
 * grouped by hash across events with a masked email and "not captured"; the count and the CSV
 * include them; registering again with the matching email backfills every row and they become
 * one contact with every event. Local file-store run only (the fixture is written to the store).
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");

const runtimePath = () => process.env.AGENCY_EVENT_OS_RUNTIME_STORE_PATH || path.join(process.cwd(), ".runtime-data", "local-playwright-runtime.json");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

function seedHashOnlyRows(eventIds: string[], emailHash: string) {
  const snapshot = JSON.parse(fs.readFileSync(runtimePath(), "utf8"));
  snapshot.attendeeProfiles = snapshot.attendeeProfiles || [];
  eventIds.forEach((eventId, index) => {
    const createdAt = `2026-09-1${index}T10:00:00.000Z`;
    snapshot.attendeeProfiles.push({ attendeeId: `legacy-${eventId}`, eventId, emailHash, emailMasked: "ca***@legacyco.io", name: "Cal Legacy", company: "Legacy Co", title: index ? "Producer" : "", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, role: "attendee", status: "active", createdAt, updatedAt: createdAt });
  });
  fs.writeFileSync(runtimePath(), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

test("hash-only people are listed and counted, exported with a blank email, then healed by a matching registration", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const email = `cal-${stamp}@legacyco.io`;
  const emailHash = createHash("sha256").update(email).digest("hex");
  const oldOne = await createNowEvent(page, `Old one ${stamp}`);
  const oldTwo = await createNowEvent(page, `Old two ${stamp}`);
  const fresh = await createNowEvent(page, `Fresh ${stamp}`);
  seedHashOnlyRows([oldOne, oldTwo], emailHash);

  // The owner sees one grouped person with two events and no email.
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await gotoAndAssert(owner, "/production-access/owner?next=/app/people");
  await owner.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await owner.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(owner).toHaveURL(/\/app\/people$/);
  const rowId = `hash-only-row-${emailHash.slice(0, 12)}`;
  const row = owner.getByTestId(rowId);
  await expect(row).toContainText("Cal Legacy");
  await expect(row).toContainText("ca***@legacyco.io");
  await expect(row).toContainText("not captured — registered before 16 Sep 2026");
  await expect(row).toHaveAttribute("data-events", "2");
  await expect(row).toContainText(`Old one ${stamp}`);
  await expect(row).toContainText(`Old two ${stamp}`);
  await expect(row).not.toContainText(email);
  const countBefore = Number(await owner.getByTestId("contacts-across-events").getAttribute("data-count"));
  const hashOnlyBefore = Number(await owner.getByTestId("contacts-across-events").getAttribute("data-hash-only"));
  expect(hashOnlyBefore).toBeGreaterThanOrEqual(1);
  const csvBefore = await owner.request.get("/api/contacts/export");
  const csvBeforeText = await csvBefore.text();
  expect(csvBeforeText).toContain('"Cal Legacy","","Legacy Co","Producer","2"');
  expect(csvBeforeText.trim().split("\n")).toHaveLength(countBefore + 1);

  // The operator sees the count, which includes them.
  await gotoAndAssert(page, "/app/people");
  expect(Number(await page.getByTestId("contacts-across-events").getAttribute("data-count"))).toBe(countBefore);

  // Cal registers again at the fresh event with the same address → both old rows heal into one contact with 3 events.
  const calContext = await browser.newContext();
  const cal = await calContext.newPage();
  await gotoAndAssert(cal, `/events/${fresh}/register`);
  await cal.locator('[name="name"]').fill("Cal Legacy");
  await cal.locator('[name="email"]').fill(email);
  await cal.locator('[name="company"]').fill("Legacy Co");
  await cal.getByRole("button", { name: /submit registration/i }).click();
  await expect(cal).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?registered=1/);

  await gotoAndAssert(owner, "/app/people");
  await expect(owner.getByTestId(rowId)).toHaveCount(0);
  const contact = owner.getByTestId(`contact-row-${email}`);
  await expect(contact).toContainText("Cal Legacy");
  await expect(owner.getByTestId(`contact-events-${email}`)).toHaveText("3");
  expect(Number(await owner.getByTestId("contacts-across-events").getAttribute("data-count"))).toBe(countBefore);
  const csvAfter = (await (await owner.request.get("/api/contacts/export")).text());
  expect(csvAfter).toContain(`"Cal Legacy","${email}","Legacy Co","Producer","3"`);
  expect(csvAfter.trim().split("\n")).toHaveLength(countBefore + 1);
  const snapshot = JSON.parse(fs.readFileSync(runtimePath(), "utf8"));
  const healed = snapshot.attendeeProfiles.filter((row: { emailHash: string }) => row.emailHash === emailHash);
  expect(healed).toHaveLength(3);
  expect(healed.every((row: { email?: string }) => row.email === email)).toBe(true);

  await calContext.close();
  await ownerContext.close();
});
