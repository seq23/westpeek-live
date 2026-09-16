import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Access codes (16 Sep 2026):
 *   every code is shown UPPERCASE with Copy code and Copy link; a speaker link opens the guest gate
 *   with both fields prefilled and one Continue lands the speaker on their portal; a code typed
 *   lowercase with spaces still opens the door; the operator sets a custom speaker code on the
 *   Access page → the old link is refused with "changed by the production team", the new one works,
 *   and the speaker who entered with the old code is sent back to the gate; the crew invite link
 *   prefills the crew gate; every gated area sends a fresh browser to its gate.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

test("codes are uppercase with links; a speaker link prefills the gate and one Continue lands on the portal; custom code rotates the old one out", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Codes ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  const speakerCode = (await page.getByTestId("generated-speaker-code").innerText()).trim();
  // Readable scheme (16 Sep 2026): WPL-[ROLE-]STEM, the stem from the event name.
  expect(speakerCode).toMatch(/^WPL-SPEAKER-[A-Z0-9]{6,8}$/);
  await expect(page.getByTestId("access-join-code")).toHaveText(/^WPL-[A-Z0-9]{6,8}$/);
  for (const role of ["crew", "speaker", "sponsor", "vip", "client"]) await expect(page.getByTestId(`copy-${role}-link`)).toBeVisible();
  const joinCode = (await page.getByTestId("access-join-code").innerText()).trim();
  const speakerLink = `/production-access/special-guest?event=${joinCode}&code=${speakerCode}`;

  // 1. The speaker link: both fields prefilled, one Continue, the portal.
  const speakerContext = await browser.newContext();
  const speaker = await speakerContext.newPage();
  await gotoAndAssert(speaker, speakerLink);
  await expect(speaker.getByLabel(/event code/i)).toHaveValue(joinCode);
  await expect(speaker.getByLabel(/special guest password/i)).toHaveValue(speakerCode);
  await expect(speaker.getByTestId("guest-code-prefilled")).toBeVisible();
  await speaker.getByRole("button", { name: /continue to assigned portal/i }).click();
  await expect(speaker).toHaveURL(new RegExp(`/speaker/events/${eventId}`));
  await expect(speaker.locator("body")).toContainText(/Speaker portal/);

  // 2. Typed lowercase with spaces and without the dash: still the door.
  const sloppyContext = await browser.newContext();
  const sloppy = await sloppyContext.newPage();
  await gotoAndAssert(sloppy, "/production-access/special-guest");
  await sloppy.getByLabel(/event code/i).fill(joinCode.toLowerCase().replace("-", " "));
  await sloppy.getByLabel(/special guest password/i).fill(` ${speakerCode.toLowerCase().replace("-", " ")} `);
  await sloppy.getByRole("button", { name: /continue to assigned portal/i }).click();
  await expect(sloppy).toHaveURL(new RegExp(`/speaker/events/${eventId}`));
  await sloppyContext.close();

  // 3. The operator sets a custom speaker code; the old link is refused and the old session is sent back to the gate.
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  await page.getByTestId("code-input-speaker").fill("founders-2026");
  await page.getByTestId("code-save-speaker").click();
  await expect(page).toHaveURL(/codeSaved=speaker/);
  await expect(page.getByTestId("code-saved-notice")).toContainText("The speaker code is set");
  await expect(page.getByTestId("generated-speaker-code")).toHaveText("FOUNDERS-2026");
  await expect(page.getByTestId("code-input-speaker")).toHaveValue("FOUNDERS-2026");
  await gotoAndAssert(speaker, `/speaker/events/${eventId}/green-room`);
  await expect(speaker).toHaveURL(/\/production-access\/special-guest\?error=rotated/);
  await expect(speaker.getByTestId("guest-code-rotated")).toBeVisible();
  await gotoAndAssert(speaker, speakerLink);
  await speaker.getByRole("button", { name: /continue to assigned portal/i }).click();
  await expect(speaker).toHaveURL(/\/production-access\/special-guest\?error=/);
  await gotoAndAssert(speaker, `/production-access/special-guest?event=${joinCode}&code=FOUNDERS-2026`);
  await speaker.getByRole("button", { name: /continue to assigned portal/i }).click();
  await expect(speaker).toHaveURL(new RegExp(`/speaker/events/${eventId}`));
  await speakerContext.close();

  // 4. Validation and uniqueness are said out loud; Regenerate mints a fresh one.
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  await page.getByTestId("code-input-vip").fill("FOUNDERS-2026");
  await page.getByTestId("code-save-vip").click();
  await expect(page.getByTestId("code-error-notice")).toContainText("already uses that code");
  await page.getByTestId("code-regenerate-vip").click();
  await expect(page).toHaveURL(/codeSaved=vip/);
  await expect(page.getByTestId("generated-vip-code")).toHaveText(/^VIP-[A-Z0-9]{6}$/);

  // 5. The crew invite link prefills the crew gate with the Crew role; the deck's speaker invite link is the speaker gate.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  await expect(page.getByTestId("copy-speaker-link")).toBeVisible();
  const crewContext = await browser.newContext();
  const crew = await crewContext.newPage();
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  const crewCode = (await page.getByTestId("generated-crew-lite-code").innerText()).trim();
  await gotoAndAssert(crew, `/production-access/crew?event=${joinCode}&code=${crewCode}&role=crew`);
  await expect(crew.getByTestId("crew-role-select")).toHaveValue("crew");
  await expect(crew.getByLabel(/crew password/i)).toHaveAttribute("data-prefilled", "true");
  await crew.getByRole("button", { name: /enter crew workspace/i }).click();
  await expect(crew).toHaveURL(new RegExp(`/crew/events/${eventId}$`));
  await crewContext.close();
});

test("every gated area sends a fresh browser to its gate", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cases: Array<[string, RegExp]> = [
    ["/crew/events/demo", /\/production-access\/crew\?next=/],
    ["/speaker/events/demo/green-room", /\/production-access\/special-guest\?next=/],
    ["/sponsor/events/demo/booth", /\/production-access\/special-guest\?next=/],
    ["/client/acme/events/demo", /\/production-access\/special-guest\?next=/],
    ["/app/events", /\/production-access\/operator\?next=/],
    ["/app/settings", /\/production-access\/owner\?next=/],
    ["/admin/testing/demo", /\/production-access\/operator\?next=/],
    ["/billing", /\/production-access\/owner\?next=/],
  ];
  for (const [path, gate] of cases) {
    await page.goto(path);
    await expect(page, path).toHaveURL(gate);
  }
  await context.close();
});
