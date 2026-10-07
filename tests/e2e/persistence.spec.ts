import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, prepare, settle } from "./helpers";
import { readManifest } from "./support/manifest";
import { signInAs } from "./support/supabase";

/**
 * Nothing the creator saves may live only in the browser. Each test saves through the real
 * screen, then reads the database directly (as creator A) to prove the data is there, and
 * reloads the page to prove the screen reads it back.
 */
const m = readManifest();
const A = m.A;
const saveBar = (page: Page) => page.getByRole("region", { name: "Unsaved changes" });

async function db() {
  return (await signInAs("A")).client;
}

test("company details, PAN and business type are saved on the store @flow", async ({ page }, testInfo) => {
  const { errors } = await prepare(page, testInfo);
  await page.goto("/settings/company");
  await settle(page);
  await page.getByLabel("Legal name").fill("E2E Test Studio");
  await page.getByRole("combobox", { name: "Business type" }).click();
  await page.getByRole("option", { name: "Sole proprietorship" }).click();
  await page.getByLabel("PAN").fill("ABCDE1234F");
  await page.getByLabel("Address", { exact: true }).fill("1 Test Street");
  await page.getByLabel("City").fill("Mumbai");
  await page.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "Maharashtra" }).click();
  await page.getByLabel("PIN code").fill("400001");
  await expect(saveBar(page)).toBeVisible();
  await saveBar(page).getByRole("button", { name: "Save changes" }).click();
  await expect(saveBar(page)).toBeHidden({ timeout: 10_000 });

  const row = (await (await db()).from("stores").select("legal_name, pan, business_type, company_address").eq("id", A.storeId).single()).data;
  expect(row).toMatchObject({ legal_name: "E2E Test Studio", pan: "ABCDE1234F", business_type: "sole_proprietor" });
  expect(row?.company_address).toContain("Mumbai");

  await page.reload();
  await settle(page);
  await expect(page.getByLabel("PAN")).toHaveValue("ABCDE1234F");
  await expect(page.getByRole("combobox", { name: "Business type" })).toContainText("Sole proprietorship");

  // Put the store back the way it was
  await (await db()).from("stores").update({ legal_name: null, pan: null, business_type: null, company_address: null }).eq("id", A.storeId);
  await expectNoConsoleErrors(errors);
});

test("a product's SKU and tax code are saved on the product @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/settings/skus");
  await settle(page);
  // Read from the database: the seeded product's SKU is listed
  await expect(page.getByText(`E2E-${m.tag}`.toUpperCase()).first()).toBeVisible();
  await page.getByRole("button", { name: `Edit E2E-${m.tag.toUpperCase()}` }).click();
  await page.getByLabel("Tax code").click();
  await page.getByRole("option", { name: /998434/ }).click();
  await page.getByLabel("SKU", { exact: true }).fill(`E2E-NEW-${m.tag}`.toUpperCase());
  await expect(saveBar(page).or(page.getByRole("button", { name: "Save changes" })).first()).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`E2E-NEW-${m.tag}`.toUpperCase()).first()).toBeVisible();

  const p = (await (await db()).from("products").select("sku, hsn_sac, tax_rate_bps").eq("id", A.productId).single()).data;
  expect(p).toMatchObject({ sku: `E2E-NEW-${m.tag}`.toUpperCase(), hsn_sac: "998434", tax_rate_bps: 1800 });
  await (await db()).from("products").update({ sku: `E2E-${m.tag}`.toUpperCase(), hsn_sac: "998433" }).eq("id", A.productId);
});

test("pinning a review is saved on the review, not in the browser @flow", async ({ page }, testInfo) => {
  test.skip(!A.reviewId, "Needs SUPABASE_SERVICE_ROLE_KEY so the setup can add a paid order with a review");
  await prepare(page, testInfo);
  await page.goto(`/store/${A.storeId}/reviews`);
  await settle(page);
  const card = page.getByRole("article", { name: /Review by E2E Buyer/ }).or(page.locator("article, li").filter({ hasText: A.reviewTitle ?? "" })).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(card.getByRole("button", { name: "Unpin" })).toBeVisible();

  expect((await (await db()).from("reviews").select("pinned").eq("id", A.reviewId!).single()).data?.pinned).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pp:pins")))).toEqual([]);

  await page.reload();
  await settle(page);
  await expect(page.getByRole("button", { name: "Unpin" }).first()).toBeVisible();
  await (await db()).from("reviews").update({ pinned: false }).eq("id", A.reviewId!);
});

test("deal paths, collections, coupons and pages are read from the database @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto(`/store/${A.storeId}/offers/coupons`);
  await settle(page);
  await expect(page.getByText(A.couponCode).first()).toBeVisible();
  await page.goto("/catalog/collections");
  await settle(page);
  await expect(page.getByText(`e2e Collection ${m.tag}`).first()).toBeVisible();
  await page.goto(`/store/${A.storeId}/design/pages`);
  await settle(page);
  await expect(page.getByText(`e2e Page ${m.tag}`).first()).toBeVisible();
  if (A.dealRuleId) {
    await page.goto(`/store/${A.storeId}/offers/deal-paths`);
    await settle(page);
    await expect(page.getByText(A.dealRuleName ?? "").first()).toBeVisible();
  }
});

test("the browser holds only the session, a change signal and display preferences @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  for (const path of ["/dashboard", "/catalog/products", "/settings/company", "/catalog/media", `/store/${A.storeId}/design/pages`]) {
    await page.goto(path);
    await settle(page);
  }
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const allowed = [/^pp:session$/, /^pp:rev$/, /^pp:progress:/, /^pp:active-store$/, /^pp:theme/, /^pp:nav-/, /^pp:gs-/, /^pp:recent-search:/, /^pp:store-theme:/, /^sb-.*-auth-token/, /^pp:coach/];
  const stray = keys.filter((k) => !allowed.some((re) => re.test(k)));
  expect(stray, `unexpected browser storage: ${stray.join(", ")}`).toEqual([]);
  expect(await page.evaluate(async () => (await indexedDB.databases?.())?.map((d) => d.name) ?? [])).not.toContain("pp-media");
});
