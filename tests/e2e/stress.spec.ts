import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, layoutIssues, prepare, report, settle } from "./helpers";

/**
 * QA Part 5 F: every list and card against the stress dataset (lib/mock/stress.ts):
 * long and unbroken text, Indic scripts, 500 products/orders, missing images,
 * huge and tiny prices, 0 / 1 / 5000 reviews, 100%-off coupon.
 */
const STRESS_ROUTES = [
  "/dashboard",
  "/products",
  "/products/prod_01",
  "/orders",
  "/orders/ord_1078",
  "/customers",
  "/customers/cus_01",
  "/analytics",
  "/store/reviews",
  "/store/offers",
  "/store/collections",
  "/s/ananya",
  "/s/ananya/products",
  "/s/ananya/second-brain-for-founders",
  "/s/ananya/monsoon-moods-12-lightroom-presets",
  "/s/ananya/the-freelance-pricing-playbook",
  "/checkout/ord_1080",
  "/s/ananya/contact",
  "/s/ananya/policies/refund",
  "/s/ananya/p/about-ananya",
  "/store/offers/deal-paths",
  "/store/pages",
  "/invoice/ord_1081",
  "/admin/orders",
  "/admin/creators",
];

for (const path of STRESS_ROUTES) {
  test(`stress ${path} @stress`, async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo, { stress: true });
    await page.goto(path);
    await settle(page);
    const issues = await layoutIssues(page);
    expect(issues, report(issues)).toEqual([]);
    await expectNoConsoleErrors(errors);
  });
}

test("5000 reviews are summarised, not rendered @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo, { stress: true });
  await page.goto("/s/ananya/second-brain-for-founders");
  await settle(page);
  await expect(page.getByText(/5,000 reviews|5000 reviews/).first()).toBeVisible();
  expect(await page.locator("#reviews li, #reviews article").count()).toBeLessThan(50);
});

test("100% off coupon gives a zero total and skips payment @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo, { stress: true });
  await page.goto("/s/ananya/the-freelance-pricing-playbook");
  await settle(page);
  await page.getByRole("button", { name: /buy now/i }).first().click();
  await page.waitForURL(/\/checkout\//);
  await settle(page);
  await page.getByRole("button", { name: /have a coupon|add a coupon|coupon/i }).first().click();
  await page.getByLabel(/coupon/i).fill("DIWALIMEGAFESTIVESALE2026EXTRA100PERCENTOFF");
  await page.getByRole("button", { name: /^apply$/i }).click();
  await expect(page.getByRole("button", { name: /get it now/i })).toBeVisible();
});

test("slow network shows skeletons @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo, { slow: true });
  await page.goto("/orders");
  await expect(page.locator('[data-slot="skeleton"]').filter({ visible: true }).first()).toBeVisible();
  await settle(page);
});

test("failed request shows an error with retry @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo, { fail: true });
  await page.goto("/orders");
  await expect(page.getByRole("alert").filter({ hasText: /didn't load|couldn't/i }).first()).toBeVisible();
  const issues = await layoutIssues(page);
  expect(issues, report(issues)).toEqual([]);
});

test("empty search results say so @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo, { stress: true });
  await page.goto("/s/ananya/products");
  await settle(page);
  await page.getByRole("main").getByRole("searchbox").first().fill("zzzz-nothing-matches");
  await expect(page.getByText(/no products match|nothing matches|no results/i).first()).toBeVisible();
});
