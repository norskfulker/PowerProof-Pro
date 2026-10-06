import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, prepare, settle } from "./helpers";
import { REDIRECTS } from "./routes";

/**
 * Part 7 gate (section D): light, dark and system everywhere with no flash; the custom domain
 * wizard through every status and problem; the nested sidebar, breadcrumbs, drawer and redirects.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** Records data-theme as the document finishes parsing, before React hydrates. */
async function firstPaintTheme(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __firstTheme?: string }).__firstTheme = document.documentElement.dataset.theme;
    });
  });
}

test.describe("themes @flow", () => {
  for (const pref of ["light", "dark"] as const) {
    test(`${pref} applies before first paint on every area, with readable text`, async ({ page }, testInfo) => {
      const { errors } = await prepare(page, testInfo);
      await page.addInitScript((p) => localStorage.setItem("pp:theme", p), pref);
      await firstPaintTheme(page);
      for (const path of ["/", "/dashboard", "/admin", "/s/ananya"]) {
        await page.goto(path);
        await settle(page);
        expect(await page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme), path).toBe(pref);
        const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        expect(axe.violations, `${path}: ${axe.violations.map((v) => v.nodes.map((n) => n.target.join(" ")).join(", ")).join("; ")}`).toEqual([]);
      }
      await expectNoConsoleErrors(errors);
    });
  }

  test("System follows the device; the toggle switches and remembers", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.emulateMedia({ colorScheme: "dark" });
    await firstPaintTheme(page);
    await page.goto("/dashboard");
    await settle(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    if (isPhone(page)) {
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Theme" }).click();
    } else {
      await page.getByRole("button", { name: /Change theme/ }).click();
    }
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await settle(page);
    expect(await page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme)).toBe("light");
  });

  test("buyers switch a store's theme in the footer; a dark store starts dark", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/s/gridgrain");
    await settle(page);
    const scope = page.locator("[data-theme]").nth(1);
    await expect(scope).toHaveAttribute("data-theme", "dark");
    const toggle = page.getByRole("group", { name: "Store theme" });
    await toggle.getByRole("button", { name: "Light" }).click();
    await expect(scope).toHaveAttribute("data-theme", "light");
    await page.reload();
    await settle(page);
    await expect(page.locator("[data-theme]").nth(1)).toHaveAttribute("data-theme", "light");
  });

  test("emails and invoices stay light in dark mode", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.addInitScript(() => localStorage.setItem("pp:theme", "dark"));
    await page.goto("/invoice/ord_1081");
    await settle(page);
    await expect(page.getByRole("article", { name: /invoice/i })).toHaveAttribute("data-theme", "light");
  });
});

test.describe("custom domain @flow", () => {
  test("one-click setup: enter, connect, verify, SSL, connected, settings, remove", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/store_ananya/domain");
    await settle(page);
    await page.getByLabel("Your domain").fill("ananya.dev");
    await expect(page.getByText("Automatic setup available").first()).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Connect automatically" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Verifying").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Checking again in \d+s/)).toBeVisible();
    for (let i = 0; i < 3 && !(await page.getByRole("button", { name: "Remove domain" }).isVisible() && (await page.getByText("is live with a free SSL certificate").isVisible())); i++) {
      await page.getByRole("button", { name: "Verify now" }).click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByText(/is live with a free SSL certificate/)).toBeVisible();
    await expect(page.getByText("Connected").first()).toBeVisible();
    await page.getByRole("switch", { name: /Redirect .* to ananya.dev/ }).click();
    await page.getByRole("region", { name: "Unsaved changes" }).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("region", { name: "Unsaved changes" })).toBeHidden();
    await page.getByRole("button", { name: "Remove domain" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove domain" }).click();
    await expect(page.getByLabel("Your domain")).toBeVisible();
    await expectNoConsoleErrors(errors);
  });

  test("manual setup shows records and host guides, never promising one click", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/store/store_ananya/domain");
    await settle(page);
    await page.getByLabel("Your domain").fill("shop.ananya.io");
    await expect(page.getByText("Manual setup needed").first()).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Connect automatically" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "DNS records" }).getByRole("listitem")).toHaveCount(2);
    for (const host of ["GoDaddy", "Namecheap", "Cloudflare", "Hostinger", "Squarespace (ex-Google)", "Others"]) {
      await page.getByRole("tab", { name: host }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
    await page.getByRole("button", { name: /added the records/ }).click();
    await expect(page.getByText("Waiting for DNS").first()).toBeVisible();
  });

  test("the simulator forces every status and every problem", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await prepare(page, testInfo);
    const states: [string, RegExp][] = [
      ["Not connected", /Not connected/],
      ["Waiting for DNS", /Waiting for DNS/],
      ["Verifying", /Verifying/],
      ["Issuing SSL", /Issuing SSL/],
      ["Connected", /free SSL certificate/],
    ];
    for (const [label, expectText] of states) {
      await page.goto("/design#domains");
      await settle(page);
      await page.getByRole("group", { name: "Force a status" }).getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByText(/Domain set to/).first()).toBeVisible();
      await page.goto("/store/store_ananya/domain");
      await settle(page);
      await expect(page.getByText(expectText).first(), label).toBeVisible();
    }
    for (const problem of ["The record points to the wrong place", "We can't find the records yet", "Two records clash", "Your domain blocks our certificate", "Still spreading"]) {
      await page.goto("/design#domains");
      await settle(page);
      await page.getByRole("group", { name: "Force a problem" }).getByRole("button", { name: problem }).click();
      await expect(page.getByText(`· ${problem}`)).toBeVisible();
      await page.goto("/store/store_ananya/domain");
      await settle(page);
      const alert = page.getByRole("alert").filter({ hasText: problem });
      await expect(alert, problem).toBeVisible();
      if (problem !== "Still spreading") await expect(page.getByText("Needs attention").first()).toBeVisible();
    }
  });

  test("Free creators see step 1, then the Upgrade dialog", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/design#plans");
    await settle(page);
    await page.getByRole("group", { name: "Mock plan" }).getByRole("button", { name: "Free" }).click();
    await expect(page.getByText("Mock account is on Free")).toBeVisible();
    await page.goto("/store/store_ananya/domain");
    await settle(page);
    await page.getByLabel("Your domain").fill("shop.ananya.in");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("dialog", { name: /Upgrade to Pro/ })).toContainText("domain");
  });
});

test.describe("navigation @flow", () => {
  test("every group opens, links match routes and breadcrumbs, counts show", async ({ page }, testInfo) => {
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
    await expect(tree.getByRole("treeitem", { name: /^Live/ })).toContainText(/\d+/);
    await tree.getByRole("treeitem", { name: /^Live/ }).click();
    await expect(page).toHaveURL(/\/catalog\/products\?status=live$/);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(/Catalog.*Products.*Live/);

    await page.goto("/store/store_ananya/offers/deal-paths");
    await settle(page);
    const deal = tree.getByRole("treeitem", { name: "Deal Paths" });
    await expect(deal).toHaveAttribute("aria-current", "page");
    await expect(tree.getByRole("treeitem", { name: "Offers", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(/Store.*Offers.*Deal Paths/);

    // Keyboard: arrows move, left closes the group, right opens it again
    await deal.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tree.getByRole("treeitem", { name: "Offers", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tree.getByRole("treeitem", { name: "Offers", exact: true })).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowRight");
    await expect(tree.getByRole("treeitem", { name: "Offers", exact: true })).toHaveAttribute("aria-expanded", "true");

    // Quick filter and the icon rail
    await page.getByRole("searchbox", { name: "Filter menu" }).fill("refund");
    await expect(tree.getByRole("treeitem", { name: "Refund", exact: true })).toBeVisible();
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
    for (const [from, to] of REDIRECTS) {
      await page.goto(from);
      await expect(page, from).toHaveURL(to, { timeout: 10_000 });
    }
  });

  test("Pro-only items show a lock on Free and open the Upgrade dialog", async ({ page }, testInfo) => {
    test.skip(isPhone(page), "Same tree in the drawer");
    await prepare(page, testInfo);
    await page.goto("/design#plans");
    await settle(page);
    await page.getByRole("group", { name: "Mock plan" }).getByRole("button", { name: "Free" }).click();
    await expect(page.getByText("Mock account is on Free")).toBeVisible();
    await page.goto("/dashboard");
    await settle(page);
    await page.getByRole("searchbox", { name: "Filter menu" }).fill("domain");
    const domain = page.getByRole("tree").getByLabel("Pro feature");
    await expect(domain).toBeVisible();
    await domain.locator("xpath=ancestor::*[@role='treeitem'][1]").click();
    await expect(page.getByRole("dialog", { name: /Upgrade to Pro/ })).toBeVisible();
  });
});
