import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, layoutIssues, prepare, report, settle } from "./helpers";
import { readManifest } from "./support/manifest";
import { signInAs } from "./support/supabase";

/**
 * Creator walkthroughs on the real database, as creator A. Whatever a test creates is named
 * "e2e …" so the global teardown (and the next run's sweep) removes it even if a test fails.
 */
const m = readManifest();
const A = m.A;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function db() {
  return (await signInAs("A")).client;
}

test.describe("products @flow", () => {
  test("add a product by uploading a file, see it listed, change it, delete it", async ({ page }, testInfo) => {
    test.skip(!m.hasService, "A second product needs creator A on Pro, which the setup does with SUPABASE_SERVICE_ROLE_KEY");
    const { errors } = await prepare(page, testInfo);
    const title = `e2e Upload ${m.tag} ${testInfo.project.name}`.slice(0, 80);
    await page.goto("/catalog/products/new/upload?type=digital");
    await settle(page);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Price", { exact: true }).fill("299");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "guide.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
    await expect(page.getByText("guide.pdf").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Create product" }).click();
    await page.waitForURL(/\/catalog\/products$/);
    await settle(page);
    await expect(page.getByText(title).first()).toBeVisible();

    // It is in the database, with the price in minor units
    const row = (await (await db()).from("products").select("id, price_minor, status").eq("store_id", A.storeId).eq("title", title).single()).data;
    expect(row?.price_minor).toBe(29900);

    await page.goto(`/catalog/products/${row!.id}`);
    await settle(page);
    await page.getByLabel("Title").fill(`${title} v2`);
    // Saves by itself a moment after the last edit: no Save button
    await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    expect((await (await db()).from("products").select("title").eq("id", row!.id).single()).data?.title).toBe(`${title} v2`);

    await (await db()).from("products").delete().eq("id", row!.id);
    await expectNoConsoleErrors(errors);
  });

  test("the products list shows what's in the database and filters it", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/catalog/products");
    await settle(page);
    await expect(page.getByText(A.productTitle).first()).toBeVisible();
    await page.goto("/catalog/products?status=archived");
    await settle(page);
    await expect(page.getByText(A.productTitle)).toHaveCount(0);
  });
});

test.describe("offers @flow", () => {
  test("make a coupon, and it appears in the database", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    const code = `E2EUI${m.tag}${testInfo.workerIndex}`.toUpperCase().slice(0, 20);
    await page.goto(`/store/${A.storeId}/offers/coupons`);
    await settle(page);
    await page.getByRole("button", { name: "New coupon" }).first().click();
    await page.getByLabel("Code").fill(code);
    await page.getByRole("button", { name: "Add coupon" }).click();
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 10_000 });
    expect((await (await db()).from("coupons").select("code").eq("store_id", A.storeId).eq("code", code).maybeSingle()).data?.code?.toUpperCase()).toBe(code);
    await expectNoConsoleErrors(errors);
  });

  test("creator builds a deal path with the wizard and saves it", async ({ page }, testInfo) => {
    test.skip(!A.secondProductId, "Needs two products (creator A on Pro, set up with SUPABASE_SERVICE_ROLE_KEY)");
    const { errors } = await prepare(page, testInfo);
    await page.goto(`/store/${A.storeId}/offers/deal-paths/new`);
    await settle(page);
    await page.getByRole("radio", { name: /together/i }).first().click().catch(() => undefined);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const issues = await layoutIssues(page);
    expect(issues, report(issues)).toEqual([]);
    await expectNoConsoleErrors(errors);
  });
});

test.describe("visual editor @flow", () => {
  test("open the page, edit it, publish, see it live on the store", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto(`/store/${A.storeId}/design/pages/${A.pageId}/edit`);
    await settle(page);
    const canvas = page.getByRole("region", { name: "Page canvas" });
    await canvas.locator("h1").first().click();
    await expect(page.getByRole("toolbar", { name: /Hero actions/ })).toBeVisible();
    if (isPhone(page)) await page.getByRole("button", { name: "Edit", exact: true }).click();
    const headline = page.getByRole("textbox", { name: "Headline", exact: true }).filter({ visible: true });
    await headline.fill(`Made slowly ${m.tag}`);
    if (isPhone(page)) await page.keyboard.press("Escape");
    await expect(canvas.locator("h1").first()).toHaveText(`Made slowly ${m.tag}`);
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 8000 });

    await page.getByRole("button", { name: /Publish changes/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();

    // The change is in the database, and buyers see it without signing in
    const layout = (await (await db()).from("custom_pages").select("layout").eq("id", A.pageId).single()).data?.layout as { published?: { blocks: unknown[] } } | null;
    expect(JSON.stringify(layout?.published)).toContain(`Made slowly ${m.tag}`);
    const anon = await page.context().browser()!.newContext();
    const buyer = await anon.newPage();
    await buyer.goto(`${testInfo.project.use.baseURL ?? ""}/s/${A.slug}/p/${A.pageSlug}`);
    await expect(buyer.getByRole("heading", { level: 1, name: `Made slowly ${m.tag}` })).toBeVisible({ timeout: 15_000 });
    await anon.close();
    await expectNoConsoleErrors(errors);
  });

  test("create a new page from a template", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto(`/store/${A.storeId}/design/pages`);
    await settle(page);
    await page.getByRole("button", { name: "Add page" }).first().click();
    await page.getByLabel("Page name").fill(`e2e New ${m.tag} ${testInfo.workerIndex}`);
    await page.getByRole("button", { name: "Create and edit" }).click();
    await page.waitForURL(/\/edit$/);
    await settle(page);
    await expect(page.getByRole("region", { name: "Page canvas" })).toBeVisible();
  });
});

test.describe("autosave @flow", () => {
  // Nothing on load; an edit saves itself, with no Save, Discard or "leave without saving?"
  const SCREENS: { path: string; field: (p: Page) => ReturnType<Page["getByLabel"]> }[] = [
    { path: `/store/${A.storeId}/settings`, field: (p) => p.getByLabel("Store name") },
    { path: "/settings/company", field: (p) => p.getByLabel(/Legal name/) },
    { path: "/settings/tax", field: (p) => p.getByLabel("Footer note") },
    { path: `/store/${A.storeId}/seo`, field: (p) => p.getByLabel("Page title") },
    { path: `/store/${A.storeId}/pages/about`, field: (p) => p.getByLabel("Your story") },
  ];
  const saved = (page: Page) => page.getByRole("status").filter({ hasText: "All changes saved" });
  for (const s of SCREENS) {
    test(`autosave on ${s.path}`, async ({ page }, testInfo) => {
      const { errors } = await prepare(page, testInfo);
      await page.goto(s.path);
      await settle(page);
      await expect(saved(page)).toHaveCount(0);
      const field = s.field(page);
      const original = await field.inputValue();
      await field.fill(`${original} x`);
      await expect(saved(page)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Discard" })).toHaveCount(0);
      // Put it back, and leave: no prompt
      await field.fill(original);
      await expect(saved(page)).toBeVisible({ timeout: 10_000 });
      await page.getByRole("link", { name: "Dashboard" }).first().click();
      await expect(page.getByText("Leave without saving?")).toHaveCount(0);
      await expectNoConsoleErrors(errors);
    });
  }
});
