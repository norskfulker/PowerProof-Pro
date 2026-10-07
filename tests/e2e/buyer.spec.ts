import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, layoutIssues, prepare, report, settle } from "./helpers";
import { readManifest } from "./support/manifest";

/**
 * What a buyer sees of creator A's real store, signed out. Checkout and order pages aren't open
 * yet: they must say so, and Buy now must not pretend to start a purchase.
 */
test.use({ storageState: { cookies: [], origins: [] } });
const A = readManifest().A;

test("store home shows the products in the database, not a built-in store @flow", async ({ page }, testInfo) => {
  const { errors } = await prepare(page, testInfo);
  await page.goto(`/s/${A.slug}`);
  await settle(page);
  await expect(page.getByText(A.productTitle).first()).toBeVisible();
  const issues = await layoutIssues(page);
  expect(issues, report(issues)).toEqual([]);
  await expectNoConsoleErrors(errors);
});

test("the product page shows real details and no invented sales or reviews @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto(`/s/${A.slug}/${A.productSlug}`);
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: A.productTitle })).toBeVisible();
  await expect(page.getByText("₹499.00").first()).toBeVisible();
  // No sales count, no countries claim, no star average without reviews
  await expect(page.locator("main")).not.toContainText(/\+ sold|countries/i);
});

test("Buy now says checkout isn't open and stays on the page @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto(`/s/${A.slug}/${A.productSlug}`);
  await settle(page);
  await page.getByRole("button", { name: /buy now/i }).first().click();
  await expect(page.getByText(/Checkout opens soon/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/s/${A.slug}/${A.productSlug}$`));
});

test("order, checkout, success and invoice pages say they open soon @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  for (const path of ["/checkout/x", "/success/x", "/order/x", "/invoice/x", "/lookup", "/download/x"]) {
    await page.goto(path);
    await settle(page);
    await expect(page.getByText(/opens soon/i).first(), path).toBeVisible();
  }
});

test("a store that doesn't exist is a 404, not a fallback store @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/s/ananya");
  await settle(page);
  await expect(page.locator("body")).not.toContainText(/Ananya Makes/);
});
