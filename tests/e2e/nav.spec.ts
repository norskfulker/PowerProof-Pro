import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, prepare, settle } from "./helpers";
import { buildRedirects } from "./routes";
import { readManifest } from "./support/manifest";

/** The sidebar, the Store tabs, the phone drawer and old addresses, on creator A's real store. */
const m = readManifest();
const A = m.A;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

test.describe("navigation @flow", () => {
  test("a short sidebar, Store as one item with tabs inside, and no breadcrumbs", async ({ page }, testInfo) => {
    test.skip(isPhone(page), "The phone drawer has its own test");
    const { errors } = await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    const tree = page.getByRole("tree", { name: "Main" });
    for (const group of ["Catalog", "Sales", "Tools", "Settings"]) {
      const item = tree.getByRole("treeitem", { name: group, exact: true });
      if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
      await expect(item).toHaveAttribute("aria-expanded", "true");
    }
    // Store is a plain link: it has no children and nothing to expand
    const store = tree.getByRole("treeitem", { name: "Store", exact: true });
    await expect(store).not.toHaveAttribute("aria-expanded", /.*/);
    await expect(tree.getByRole("treeitem", { name: "Store", exact: true }).locator("svg").first()).toBeVisible();
    // Store settings sit under Settings and have no icon
    const settings = tree.getByRole("treeitem", { name: "Store", exact: true }).last();
    await expect(settings.locator("svg")).toHaveCount(0);

    await store.first().click();
    await expect(page).toHaveURL(/\/store\/[^/]+\/design\/base$/);
    const tabs = page.getByRole("navigation", { name: "Store", exact: true });
    await expect(tabs.getByRole("link")).toHaveText(["Design", "Info pages", "Offers", "Reviews and Q&A", "SEO"]);
    await tabs.getByRole("link", { name: "Offers" }).click();
    await expect(page).toHaveURL(/\/offers\/coupons$/);
    await expect(page.getByRole("navigation", { name: "Offers sections" }).getByRole("link")).toHaveText(["Coupons", "Bundles", "Deal Paths", "Limited-time deals"]);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);

    // Clicking a group only opens or closes it: the page stays where it is
    const url = page.url();
    const catalog = tree.getByRole("treeitem", { name: "Catalog", exact: true });
    const wasOpen = (await catalog.getAttribute("aria-expanded")) === "true";
    await catalog.click();
    await expect(catalog).toHaveAttribute("aria-expanded", String(!wasOpen));
    await expect(page).toHaveURL(url);

    // Domain is its own setting, and so is Store settings: no tabs on either
    await page.goto(`/store/${A.storeId}/domain`);
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Store", exact: true })).toHaveCount(0);
    // Store settings: no tabs, it is a Settings page
    await page.goto(`/store/${A.storeId}/settings`);
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Store", exact: true })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Filter menu" }).fill("customers");
    await expect(tree.getByRole("treeitem", { name: "Customers", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Filter menu" }).fill("");
    await page.getByRole("button", { name: "Collapse sidebar to icons" }).click();
    await expect(page.getByRole("searchbox", { name: "Filter menu" })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expectNoConsoleErrors(errors);
  });

  test("phones: four tabs and a drawer", async ({ page }, testInfo) => {
    test.skip(!isPhone(page), "Desktop has the sidebar");
    await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    const tabs = page.getByRole("navigation", { name: "Quick" });
    for (const t of ["Home", "Products", "Orders", "Settings"]) await expect(tabs.getByRole("link", { name: t })).toBeVisible();
    await tabs.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("treeitem", { name: "Sales", exact: true }).click();
    await drawer.getByRole("treeitem", { name: "Orders", exact: true }).click();
    await expect(page).toHaveURL(/\/sales\/orders$/);
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
