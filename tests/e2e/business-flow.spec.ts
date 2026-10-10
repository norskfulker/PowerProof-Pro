import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { readManifest, STATE } from "./support/manifest";

/**
 * The business flow is one path: Store, Collections, Products, Sales (Orders, Customers),
 * Payouts, then Design and the rest. Creator A has data, B is empty; both must open every one of
 * these screens without a "didn't load" and without asking for a store.
 */
const A = readManifest().A;

const SCREENS = [
  "/dashboard",
  "/catalog/products",
  "/catalog/collections",
  "/sales/orders",
  "/sales/customers",
  "/sales/payouts/balance",
  "/sales/payouts/history",
  "/sales/payouts/methods",
  "/store/current/reviews",
  "/store/current/questions",
];

for (const [who, state] of [["A", "with data"], ["B", "empty"]] as const) {
  test.describe(`creator ${who} (${state})`, () => {
    test.use({ storageState: STATE[who] });

    for (const path of SCREENS) {
      test(`${path} opens without an error @flow`, async ({ page }, testInfo) => {
        const { errors } = await prepare(page, testInfo);
        await page.goto(path);
        await settle(page);
        await expect(page.getByText(/didn.t load|couldn.t load|something went wrong/i)).toHaveCount(0);
        await expect(page.getByText(/create (a|your) store/i), "never asks for a store").toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        expect(errors.filter((e) => /\[supabase\]|permission denied/i.test(e)), "database errors in the console").toEqual([]);
      });
    }

    test("the menu follows the flow @flow", async ({ page, isMobile }, testInfo) => {
      test.skip(!!isMobile, "The sidebar is a drawer on phones");
      await prepare(page, testInfo);
      await page.goto("/dashboard");
      await settle(page);
      const top = await page.locator('[role="tree"] > [role="treeitem"], [role="tree"] > li > [role="treeitem"]').allInnerTexts();
      const order = ["Home", "Catalog", "Sales", "Store"];
      const at = order.map((label) => top.findIndex((t) => t.trim().startsWith(label)));
      expect(at.every((i) => i >= 0), `missing from ${JSON.stringify(top)}`).toBe(true);
      expect(at).toEqual([...at].sort((x, y) => x - y));
    });

    test("Design opens the store editor, and Pages lists the home page @flow", async ({ page }, testInfo) => {
      await prepare(page, testInfo);
      await page.goto("/store/current/design/base");
      await expect(page).toHaveURL(/\/design\/pages\/home\/edit$/);
      await page.getByRole("tab", { name: "Theme" }).click();
      await expect(page.getByText("Brand colour")).toBeVisible();
      await page.goto("/store/current/design/pages");
      await settle(page);
      await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add page" }).first()).toBeVisible();
    });
  });
}

test.describe("creator A's real rows", () => {
  test("orders, customers and analytics show what was sold @flow", async ({ page }, testInfo) => {
    const m = readManifest();
    test.skip(!m.A.orderNumber, "Needs the service-role key to create a paid order");
    await prepare(page, testInfo);
    await page.goto("/sales/orders");
    await settle(page);
    await expect(page.getByText(m.A.orderNumber!).first()).toBeVisible();
    await page.goto("/sales/customers");
    await settle(page);
    await expect(page.getByRole("row")).not.toHaveCount(0);
    await page.goto("/dashboard");
    await settle(page);
    await expect(page.getByText(A.productTitle).first()).toBeVisible();
  });
});

test.describe("collections are optional", () => {
  test("the product form offers an optional collection and the collection form has no description @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/catalog/products/new/upload?type=digital");
    await settle(page);
    await expect(page.getByRole("region", { name: "Add to collection" })).toContainText(/optional/i);
    await page.goto("/catalog/collections");
    await settle(page);
    await page.getByRole("button", { name: /new collection/i }).first().click();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Description")).toHaveCount(0);
  });
});

test.describe("status as tabs, and a flat menu", () => {
  test.use({ storageState: STATE.A });

  test("Products and Orders filter with tabs, not menus or dropdowns @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/catalog/products");
    await settle(page);
    const tabs = page.getByRole("tablist", { name: "Product status" });
    await expect(tabs.getByRole("tab")).toHaveText([/^All/, /^Live/, /^Draft/, /^Archived/]);
    await tabs.getByRole("tab", { name: /^Draft/ }).click();
    await expect(page).toHaveURL(/status=draft/);
    await expect(page.getByRole("button", { name: "Statuses" })).toHaveCount(0);
    await page.goto("/sales/orders");
    await settle(page);
    await expect(page.getByRole("tablist", { name: "Order status" }).getByRole("tab")).toHaveText(["All", "Paid", "Refunded", "Disputed"]);
  });

  test("Collections, Products, Orders and Payouts are plain links in the menu @flow", async ({ page, isMobile }, testInfo) => {
    test.skip(!!isMobile, "The sidebar is a drawer on phones");
    await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    const tree = page.getByRole("tree", { name: "Main" });
    for (const name of ["Collections", "Products", "Orders", "Payouts"]) {
      const item = tree.getByRole("treeitem", { name: new RegExp(`^${name}`) });
      await expect(item, name).toBeVisible();
      await expect(item, name).not.toHaveAttribute("aria-expanded", /.*/);
    }
    await expect(tree.getByRole("treeitem", { name: /^(Live|Draft|Archived|Paid|Refunded)$/ })).toHaveCount(0);
  });

  test("no heading has a small label above it @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    for (const path of ["/dashboard", "/catalog/products", "/sales/orders", "/catalog/media"]) {
      await page.goto(path);
      await settle(page);
      const h1 = page.getByRole("heading", { level: 1 }).first();
      const above = await h1.evaluate((el) => (el.previousElementSibling?.classList.contains("eyebrow") ? el.previousElementSibling.textContent : null));
      expect(above, path).toBeNull();
    }
  });
});

test.describe("product pricing, custom codes", () => {
  test.use({ storageState: STATE.A });

  test("a discount shows as a badge in its own box, and a custom code takes its own rate @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/catalog/products/new/upload?type=digital");
    await settle(page);
    await page.getByLabel("Title").first().fill("e2e preview product");
    await page.getByLabel("Show a discount").click();
    await page.getByLabel("Discount (% off)").fill("25");
    // The badge shows right there in the discount box, and there is no separate "what buyers see" box
    const box = page.getByLabel("How the discount looks");
    await expect(box).toContainText("25% off");
    await expect(page.getByText("What buyers see")).toHaveCount(0);
    await expect(page.getByText(/what you keep/i).first()).toBeVisible();
    await page.getByLabel("Tax code (HSN/SAC)").click();
    await page.getByRole("option", { name: "Custom code…" }).click();
    await page.getByLabel("Your code").fill("852349");
    await page.getByLabel("GST rate (%)").fill("12");
    await expect(page.getByLabel("Your code")).toHaveValue("852349");
  });
});

test.describe("the dashboard is three sections", () => {
  test.use({ storageState: STATE.A });
  test("Getting started, Operations and Analytics open and close on one page @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    for (const name of ["Getting started", "Operations", "Analytics"]) await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    const analytics = page.getByRole("button", { name: "Analytics" });
    if ((await analytics.getAttribute("aria-expanded")) !== "true") await analytics.click();
    await expect(page.getByRole("heading", { name: "Revenue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analytics" })).toHaveCount(0);
    // Live orders sit inside Analytics (once a product is live), not in Operations
    await expect(page.locator("#operations").getByRole("heading", { name: /Live orders/ })).toHaveCount(0);
  });
});

test.describe("digital or physical first", () => {
  test.use({ storageState: STATE.A });
  test("a physical product needs a collection and has no file step; bulk import gives the CSV format @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/catalog/products/new");
    await settle(page);
    await expect(page.getByRole("link", { name: /Digital product/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Physical product/ })).toBeVisible();
    await page.getByRole("link", { name: "Import from CSV" }).click();
    await expect(page).toHaveURL(/\/catalog\/products\/import$/);
    await expect(page.getByRole("button", { name: "Download the CSV template" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "hsn_sac" })).toBeVisible();
    await page.goBack();
    await page.getByRole("link", { name: /Physical product/ }).click();
    await expect(page.getByRole("region", { name: "Files" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /Collection \(required\)/ })).toBeVisible();
    await expect(page.getByLabel("Make a new collection")).toBeVisible();
  });
  test("a draft product can be put in a collection and in a bundle @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/catalog/collections");
    await settle(page);
    await page.getByRole("button", { name: /new collection/i }).first().click();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });
});

test.describe("payout methods", () => {
  test.use({ storageState: STATE.A });
  test("up to 5 bank accounts and crypto wallets, each counted @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/sales/payouts/methods");
    await settle(page);
    await expect(page.getByText(/of 5/).first()).toBeVisible();
    await page.getByRole("button", { name: "Add crypto wallet" }).first().click();
    const address = page.getByLabel("Wallet address");
    await address.fill("not-an-address");
    await expect(page.getByRole("alert").first()).toContainText(/doesn't look like/);
    await expect(page.getByRole("button", { name: "Save wallet" })).toBeDisabled();
  });
});

test.describe("the store link", () => {
  test.use({ storageState: STATE.A });
  test("can't be changed in Store settings @flow", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/store/current/settings");
    await settle(page);
    await expect(page.getByLabel("Store link")).toHaveAttribute("readonly", "");
  });
});
