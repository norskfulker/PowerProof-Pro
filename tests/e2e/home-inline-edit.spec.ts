import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { STATE } from "./support/manifest";

/** Base design: click a section in the preview and its editor opens right there; HTML upload works. */
test.use({ storageState: STATE.A });

test("clicking a section in the preview opens that section's editor, and typing updates the preview @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/store/current/design/base");
  await settle(page);
  const preview = page.frameLocator("iframe").first();
  await expect(preview.locator('[data-pp-section="hero"]')).toBeVisible({ timeout: 20_000 });
  await preview.locator('[data-pp-section="hero"]').click();
  const headline = page.getByLabel("Headline", { exact: true });
  await expect(headline).toBeVisible();
  // No navigation happened: still on the one screen
  await expect(page).toHaveURL(/\/design\/base$/);
  await headline.fill("e2e inline headline");
  await expect(preview.getByText("e2e inline headline").first()).toBeVisible();
  await preview.locator('[data-pp-section="newsletter"]').click();
  await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
});

test("an HTML file can be chosen or dropped, shows in the preview in a safe frame, and can be removed @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/store/current/design/base");
  await settle(page);
  await page.getByRole("button", { name: "Custom HTML" }).click();
  await page.locator('input[type="file"][accept*="html"]').setInputFiles({ name: "e2e-promo.html", mimeType: "text/html", buffer: Buffer.from("<h2 id='x'>e2e html section</h2><script>document.getElementById('x').dataset.ran='1'</script>") });
  await expect(page.getByText("e2e-promo.html")).toBeVisible();
  const section = page.frameLocator("iframe").first().frameLocator('iframe[title="e2e-promo.html"]');
  await expect(section.getByText("e2e html section")).toBeVisible({ timeout: 20_000 });
  // The frame can't reach the store page around it
  const sandbox = await page.frameLocator("iframe").first().locator('iframe[title="e2e-promo.html"]').getAttribute("sandbox");
  expect(sandbox).not.toContain("allow-same-origin");
  await page.getByRole("button", { name: /Remove e2e-promo.html/ }).click();
  await expect(page.getByText("e2e-promo.html")).toHaveCount(0);
  // Nothing saved: leave without publishing the test file
  await page.getByRole("button", { name: /discard/i }).click().catch(() => undefined);
});
