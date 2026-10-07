import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, prepare, settle } from "./helpers";
import { readManifest } from "./support/manifest";

/** Light, dark and system everywhere with no flash, on creator A's real store. */
const A = readManifest().A;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** Records data-theme as the document finishes parsing, before React hydrates. */
async function firstPaintTheme(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __firstTheme?: string }).__firstTheme = document.documentElement.dataset.theme;
    });
  });
}
const firstTheme = (page: Page) => page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme);

test.describe("themes @flow", () => {
  for (const pref of ["light", "dark"] as const) {
    test(`${pref} applies before first paint with readable text`, async ({ page }, testInfo) => {
      const { errors } = await prepare(page, testInfo);
      await page.addInitScript((p) => localStorage.setItem("pp:theme", p), pref);
      await firstPaintTheme(page);
      for (const path of ["/dashboard", `/s/${A.slug}`]) {
        await page.goto(path);
        await settle(page);
        expect(await firstTheme(page), path).toBe(pref);
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
    expect(await firstTheme(page)).toBe("light");
  });

  test.describe("buyers", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("switch a store's theme in the footer and the choice is remembered", async ({ page }, testInfo) => {
      await prepare(page, testInfo);
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto(`/s/${A.slug}`);
      await settle(page);
      const scope = page.locator("[data-theme]").nth(1);
      const toggle = page.getByRole("group", { name: "Store theme" });
      await toggle.getByRole("button", { name: "Dark" }).click();
      await expect(scope).toHaveAttribute("data-theme", "dark");
      await page.reload();
      await settle(page);
      await expect(page.locator("[data-theme]").nth(1)).toHaveAttribute("data-theme", "dark");
    });
  });
});
