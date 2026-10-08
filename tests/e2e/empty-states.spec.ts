import { expect, test } from "@playwright/test";
import { layoutIssues, prepare, report, settle } from "./helpers";
import { STATE } from "./support/manifest";

/**
 * Creator B never gets any data, so this is what a brand-new account sees: a real empty state on
 * every list, one clear next step, nothing made up, and no layout jump when the data arrives.
 */
test.use({ storageState: STATE.B });

const LISTS: { path: string; heading: RegExp; action: RegExp }[] = [
  { path: "/catalog/products", heading: /No products yet/, action: /Add your first product/ },
  { path: "/catalog/collections", heading: /No collections yet/, action: /New collection/ },
  { path: "/catalog/bundles", heading: /No bundles yet/, action: /New bundle/ },
  { path: "/catalog/media", heading: /No files yet/, action: /Upload a file/ },
  { path: "/sales/orders", heading: /Nothing sold yet/, action: /Get your store link/ },
  { path: "/sales/customers", heading: /No customers yet/, action: /Get your store link/ },
  { path: "/sales/payouts/history", heading: /No payouts yet/, action: /Add a payout method/ },
  { path: "/store/current/offers/coupons", heading: /No coupons yet/, action: /New coupon/ },
  { path: "/store/current/offers/deal-paths", heading: /No deal paths yet/, action: /New deal path/ },
  { path: "/store/current/design/pages", heading: /Launch page/, action: /Add page/ },
  { path: "/store/current/reviews", heading: /No reviews yet/, action: /Get your store link/ },
  { path: "/store/current/questions", heading: /No questions yet/, action: /See your products/ },
];

/** Words that would mean sample content leaked into the product */
const MADE_UP = /\b(demo|sample|lorem|mock|example\.com|faker)\b/i;

for (const l of LISTS) {
  test(`empty ${l.path} @flow`, async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto(l.path);
    await settle(page);
    await expect(page.getByText(l.heading).first()).toBeVisible();
    await expect(page.getByRole("link", { name: l.action }).or(page.getByRole("button", { name: l.action })).filter({ visible: true }).first()).toBeVisible();
    expect(await page.locator("main").innerText(), "made-up content on an empty screen").not.toMatch(MADE_UP);
    const issues = await layoutIssues(page);
    expect(issues, report(issues)).toEqual([]);
  });
}

test("with no visits yet, the visit charts stay empty and nothing is estimated @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/dashboard");
  await settle(page);
  // Analytics is a section of the dashboard: open it
  const analytics = page.getByRole("button", { name: "Analytics" });
  if ((await analytics.getAttribute("aria-expanded")) !== "true") await analytics.click();
  // With no visits recorded, Visitors and Conversion read 0 and the three charts that depend on visits stay as empty charts
  await expect(page.getByText("No visits recorded yet")).toHaveCount(3);
  for (const name of ["Revenue", "Top products", "Where buyers come from", "Visitors", "Funnel"]) await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Funnel", exact: true })).toBeVisible();
});

test("everything not built yet says 'coming soon', with no pretend data @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  for (const path of ["/settings/team", "/tools/ai-images"]) {
    await page.goto(path);
    await settle(page);
    await expect(page.getByText(/coming soon|opens soon/i).first(), path).toBeVisible();
    expect(await page.locator("main, body").first().innerText(), path).not.toMatch(MADE_UP);
  }
});

test("a new account's settings start blank, not filled in @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/settings/company");
  await settle(page);
  await expect(page.getByLabel(/Legal name/)).toHaveValue("");
  await expect(page.getByLabel("GSTIN")).toHaveValue("");
  await page.goto("/settings/skus");
  await settle(page);
  await expect(page.getByText(/No SKUs yet/)).toBeVisible();
});

test("lists don't jump when the data arrives (layout shift under 0.1) @flow", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "Layout shift is only measured in Chromium");
  await prepare(page, testInfo);
  for (const path of ["/catalog/products", "/sales/orders", "/sales/customers", "/store/current/reviews"]) {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(path);
    await settle(page);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, `${path} shifted by ${cls}`).toBeLessThan(0.1);
  }
});
