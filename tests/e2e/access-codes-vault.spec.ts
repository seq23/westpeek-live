import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The access-codes vault in the Owner Console: the owner sees every code for every event, masked
 * until Reveal, searchable by a code someone handed her, rotatable in place (the old code then
 * fails the gate); an operator session does not get the fold at all; and the four global gates
 * render SET / NOT SET — their values never reach the page.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");

const ownerPassword = () => process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

test("owner sees every code masked-until-reveal, finds an event by a code, rotates one; an operator gets no vault and no secret values", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Vault Room ${Date.now()}`);

  // The operator's console redirect means the fold is not theirs; the vault section itself refuses.
  await gotoAndAssert(page, "/app/owner");
  await expect(page).toHaveURL(/\/production-access\/launchpad/);

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await gotoAndAssert(owner, "/production-access/owner?next=/app/owner");
  await owner.getByLabel(/owner master password/i).fill(ownerPassword());
  await owner.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(owner).toHaveURL(/\/app\/owner$/);
  await expect(owner.getByTestId("console-section-access-codes")).toHaveAttribute("data-hydrated", "true");
  await owner.getByTestId("console-section-access-codes-toggle").click();
  const vault = owner.getByTestId("access-codes-vault");
  await expect(vault).toBeVisible();

  // The three gate passwords the owner has to type again are here, masked until Reveal. The spare
  // owner key is reported set / not set and its value never reaches the page.
  const ownerGate = owner.getByTestId("vault-gate-OWNER_MASTER_ACCESS_PASSWORD");
  await expect(ownerGate).toHaveAttribute("data-set", "true");
  await expect(owner.getByTestId("vault-gate-value-OWNER_MASTER_ACCESS_PASSWORD")).toContainText("•");
  const maskedBody = await owner.locator("body").innerText();
  expect(maskedBody).not.toContain(ownerPassword());
  await owner.getByTestId("vault-gate-reveal-OWNER_MASTER_ACCESS_PASSWORD").click();
  await expect(owner.getByTestId("vault-gate-value-OWNER_MASTER_ACCESS_PASSWORD")).toHaveText(ownerPassword());
  await owner.getByTestId("vault-gate-reveal-OPERATOR_LAUNCHPAD_PASSWORD").click();
  await expect(owner.getByTestId("vault-gate-value-OPERATOR_LAUNCHPAD_PASSWORD")).toHaveText(requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
  await owner.getByTestId("vault-gate-reveal-CREW_ACCESS_PASSWORD").click();
  await expect(owner.getByTestId("vault-gate-value-CREW_ACCESS_PASSWORD")).toHaveText(requiredDay1Default("CREW_ACCESS_PASSWORD"));
  // The spare: no value, no Reveal, just the rotation command.
  const spare = owner.getByTestId("vault-gate-OWNER_MASTER_ACCESS_PASSWORD_2");
  await expect(spare).toContainText("npx wrangler secret put OWNER_MASTER_ACCESS_PASSWORD_2");
  await expect(owner.getByTestId("vault-gate-reveal-OWNER_MASTER_ACCESS_PASSWORD_2")).toHaveCount(0);
  const spareValue = process.env.OWNER_MASTER_ACCESS_PASSWORD_2 || "";
  const revealedBody = await owner.locator("body").innerText();
  if (spareValue) expect(revealedBody).not.toContain(spareValue);
  // The console response is never cached: it now carries these values.
  const consoleResponse = await owner.request.get("/app/owner");
  expect(consoleResponse.headers()["cache-control"] || "").toContain("no-store");

  // Per-event codes: masked until Reveal.
  const speaker = owner.getByTestId(`vault-code-${eventId}-speaker`);
  await expect(speaker).toHaveAttribute("data-revealed", "false");
  await expect(speaker).toContainText("•");
  await owner.getByTestId(`vault-reveal-${eventId}-speaker`).click();
  await expect(speaker).toHaveAttribute("data-revealed", "true");
  const speakerCode = (await owner.getByTestId(`vault-code-value-${eventId}-speaker`).innerText()).trim();
  expect(speakerCode).not.toContain("•");

  // Search by the code someone handed her finds the event; a code nobody has finds nothing.
  await owner.getByTestId("vault-search").fill(speakerCode.toLowerCase());
  await expect(owner.getByTestId(`vault-event-${eventId}`)).toBeVisible();
  await owner.getByTestId("vault-search").fill("ZZZ-NOT-A-CODE");
  await expect(owner.getByTestId("vault-no-match")).toBeVisible();
  await owner.getByTestId("vault-search").fill("");

  // Rotate it: the code changes and the OLD one no longer opens the gate.
  owner.once("dialog", (dialog) => { expect(dialog.message()).toContain("stops working immediately"); void dialog.accept(); });
  await owner.getByTestId(`vault-rotate-${eventId}-speaker`).click();
  await expect(owner).toHaveURL(/\/app\/events\/.*\/access\?codeSaved=speaker/);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await gotoAndAssert(guest, "/production-access/special-guest");
  await guest.getByLabel(/event code/i).fill(eventId);
  await guest.getByLabel(/special guest password/i).fill(speakerCode);
  await guest.getByRole("button", { name: /continue to assigned portal/i }).click();
  await expect(guest.locator("body")).toContainText(/did not match a speaker, sponsor, client, or VIP access group/i);

  await guestContext.close();
  await ownerContext.close();
});
