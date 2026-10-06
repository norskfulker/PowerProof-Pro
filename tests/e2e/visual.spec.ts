import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";

/**
 * Visual snapshots (QA Part 5 G) at mobile, tablet and desktop (projects visual-*).
 * The clock is frozen and live timers are masked so screenshots are stable.
 * When a snapshot differs, fix the UI. Only update a baseline for an intended design change.
 */
const SCREENS: [name: string, path: string][] = [
  ["design", "/design"],
  ["home", "/"],
  ["store-home", "/s/ananya"],
  ["product", "/s/ananya/second-brain-for-founders"],
  ["checkout", "/checkout/ord_1080"],
  ["store-page", "/s/ananya/p/about-ananya"],
  ["dashboard", "/dashboard"],
  ["deal-paths", "/store/store_ananya/offers/deal-paths"],
  ["deal-wizard", "/store/store_ananya/offers/deal-paths/new"],
  ["store-pages", "/store/store_ananya/design/pages"],
  ["page-editor", "/store/store_ananya/design/pages/vp_ananya_diwali-sale/edit"],
  ["admin-search", "/admin/system/search?q=%40ananya"],
];

for (const [name, path] of SCREENS) {
  test(`visual ${name} @visual`, async ({ page }, testInfo) => {
    await prepare(page, testInfo, { frozen: true });
    await page.goto(path);
    await settle(page);
    // Let images and covers finish laying out
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: !path.includes("/edit"),
      mask: [page.locator('[role="timer"]'), page.locator("[data-live-time]")],
    });
  });
}
