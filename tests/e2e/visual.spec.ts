import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { readManifest } from "./support/manifest";

/**
 * Visual snapshots (QA Part 5 G) at mobile, tablet and desktop (projects visual-*), on the data
 * the tests create for creator A. The clock is frozen and live timers are masked.
 *
 * Baselines are not committed from the old demo data. Create them once with
 * `npx playwright test --grep @visual --update-snapshots`, look at every image, then commit.
 * After that, when a snapshot differs, fix the UI; only update a baseline for an intended change.
 */
const m = readManifest();
const A = m.A;

const SCREENS: [name: string, path: string, signedOut?: boolean][] = [
  ["home", "/", true],
  ["store-home", `/s/${A.slug}`, true],
  ["product", `/s/${A.slug}/${A.productSlug}`, true],
  ["store-page", `/s/${A.slug}/p/${A.pageSlug}`, true],
  ["dashboard", "/dashboard"],
  ["products", "/catalog/products"],
  ["orders", "/sales/orders"],
  ["store-pages", `/store/${A.storeId}/design/pages`],
  ["page-editor", `/store/${A.storeId}/design/pages/${A.pageId}/edit`],
  ["deal-wizard", `/store/${A.storeId}/offers/deal-paths/new`],
];

for (const [name, path, signedOut] of SCREENS) {
  test.describe(name, () => {
    if (signedOut) test.use({ storageState: { cookies: [], origins: [] } });

    test(`visual ${name} @visual`, async ({ page }, testInfo) => {
      await prepare(page, testInfo, { frozen: true });
      await page.goto(path);
      await settle(page);
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: !path.includes("/edit"),
        mask: [page.locator('[role="timer"]'), page.locator("[data-live-time]"), page.locator("time")],
      });
    });
  });
}

// A long dialog on a small phone: it must fit the screen, scroll inside itself, and keep header, close and footer in view
test.describe("dialog overflow", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("visual dialog-overflow-360x640 @visual", async ({ page }, testInfo) => {
    await prepare(page, testInfo, { frozen: true });
    await page.goto(`/store/${A.storeId}/design/pages`);
    await settle(page);
    await page.getByRole("button", { name: /add page/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // The body scrolls; the header, close button and footer don't move
    const parts = [dialog.getByRole("heading", { name: "Add page" }), dialog.getByRole("button", { name: "Close" }), dialog.getByRole("button", { name: /create and edit/i })];
    const before = await Promise.all(parts.map((l) => l.boundingBox()));
    await page.locator('[data-slot="dialog-body"]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const after = await Promise.all(parts.map((l) => l.boundingBox()));
    expect(after).toEqual(before);
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("dialog-overflow-360x640.png");
  });
});
