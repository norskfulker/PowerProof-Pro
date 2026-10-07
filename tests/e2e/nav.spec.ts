import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, prepare, settle } from "./helpers";
import { buildRedirects } from "./routes";
import { readManifest } from "./support/manifest";

/** The nested sidebar, breadcrumbs, phone drawer and old addresses, on creator A's real store. */
const m = readManifest();
const A = m.A;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

test.describe("navigation @flow", () => {
  test("every group opens, links match routes and breadcrumbs, counts come from the database", async ({ page }, testInfo) => {
    test.skip(isPhone(page), "The phone drawer has its own test");
    const { errors } = await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    const tree = page.getByRole("tree", { name: "Main" });
    for (const group of ["Catalog", "Store", "Sales", "Tools", "Settings"]) {
      const item = tree.getByRole("treeitem", { name: group, exact: true });
      if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
      await expect(item).toHaveAttribute("aria-expanded", "true");
    }
    await tree.getByRole("treeitem", { name: "Products", exact: true }).click();
    // The seeded product is live, so the Live count is at least 1
    await expect(tree.getByRole("treeitem", { name: /^Live/ })).toContainText(/[1-9]/);
    await tree.getByRole("treeitem", { name: /^Live/ }).click();
    await expect(page).toHaveURL(/\/catalog\/products\?status=live$/);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(/Catalog.*Products.*Live/);

    await page.goto(`/store/${A.storeId}/offers/coupons`);
    await settle(page);
    await expect(tree.getByRole("treeitem", { name: "Offers", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(/Store.*Offers.*Coupons/);

    await page.getByRole("searchbox", { name: "Filter menu" }).fill("coupons");
    await expect(tree.getByRole("treeitem", { name: "Coupons", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Filter menu" }).fill("");
    await page.getByRole("button", { name: "Collapse sidebar to icons" }).click();
    await expect(page.getByRole("searchbox", { name: "Filter menu" })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expectNoConsoleErrors(errors);
  });

  test("phones: four tabs and a drawer with the same nesting", async ({ page }, testInfo) => {
    test.skip(!isPhone(page), "Desktop has the sidebar");
    await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    const tabs = page.getByRole("navigation", { name: "Quick" });
    for (const t of ["Home", "Products", "Orders", "Store"]) await expect(tabs.getByRole("link", { name: t })).toBeVisible();
    await tabs.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("treeitem", { name: "Sales", exact: true }).click();
    await drawer.getByRole("treeitem", { name: "Orders", exact: true }).click();
    await drawer.getByRole("treeitem", { name: "Paid" }).click();
    await expect(page).toHaveURL(/\/sales\/orders\?status=paid$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("old addresses redirect", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    for (const [from, to] of buildRedirects(m)) {
      await page.goto(from);
      await expect(page, from).toHaveURL(to, { timeout: 10_000 });
    }
  });

  test("the founder console is closed to creators", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
