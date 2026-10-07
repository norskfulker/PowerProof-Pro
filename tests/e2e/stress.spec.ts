import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, failDatabase, layoutIssues, prepare, report, settle, slowDatabase } from "./helpers";
import { readManifest } from "./support/manifest";
import { signInAs } from "./support/supabase";

/**
 * QA Part 5 F, on real rows: long and unbroken text, Indic scripts, a huge price. The seeded
 * product is given the stress values for these tests and put back afterwards. Error and loading
 * states are forced by failing or delaying the database requests, not by a demo switch.
 */
const A = readManifest().A;
const STRESS_TITLE = "The Complete Ultimate Second Brain Operating System for Busy Founders, Freelancers, Students and Teams (2026 Edition) नोशन में दूसरा दिमाग़ Supercalifragilisticexpialidociousproductivitysystemwithnospaces";

test.describe.configure({ mode: "serial" });

test.describe("stress text on real rows @stress", () => {
  test.beforeAll(async () => {
    const { client } = await signInAs("A");
    await client.from("products").update({ title: STRESS_TITLE, price_minor: 999999900, compare_at_price_minor: 1999999900 }).eq("id", A.productId);
  });
  test.afterAll(async () => {
    const { client } = await signInAs("A");
    await client.from("products").update({ title: A.productTitle, price_minor: 49900, compare_at_price_minor: null }).eq("id", A.productId);
  });

  for (const path of ["/dashboard", "/catalog/products", `/catalog/products/${A.productId}`, `/s/${A.slug}`, `/s/${A.slug}/products`, `/s/${A.slug}/${A.productSlug}`]) {
    test(`stress ${path}`, async ({ page }, testInfo) => {
      const { errors } = await prepare(page, testInfo);
      await page.goto(path);
      await settle(page);
      const issues = await layoutIssues(page);
      expect(issues, report(issues)).toEqual([]);
      await expectNoConsoleErrors(errors);
    });
  }
});

test("slow database shows skeletons @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await slowDatabase(page);
  await page.goto("/catalog/products");
  await expect(page.locator('[data-slot="skeleton"]').filter({ visible: true }).first()).toBeVisible();
  await settle(page);
  await expect(page.getByText(A.productTitle).first()).toBeVisible();
});

test("failed requests show an error with retry, and retrying recovers @stress", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await failDatabase(page);
  await page.goto("/catalog/products");
  await expect(page.getByRole("alert").filter({ hasText: /didn't load|couldn't/i }).first()).toBeVisible();
  const issues = await layoutIssues(page);
  expect(issues, report(issues)).toEqual([]);
  await page.unroute(/\/rest\/v1\//);
  await page.getByRole("button", { name: /try again/i }).first().click();
  await expect(page.getByText(A.productTitle).first()).toBeVisible();
});

test.describe("store search @stress", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a search with no matches says so", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto(`/s/${A.slug}/products`);
    await settle(page);
    await page.getByRole("main").getByRole("searchbox").first().fill("zzzz-nothing-matches");
    await expect(page.getByText(/no products match|nothing matches|no results/i).first()).toBeVisible();
  });
});
