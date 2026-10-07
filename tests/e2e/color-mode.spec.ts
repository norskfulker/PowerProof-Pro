import { expect, test, type Page } from "@playwright/test";
import { prepare, settle } from "./helpers";

/**
 * The colour-mode toggle: one segmented radio group, a sliding thumb, keyboard support, saved
 * across reloads and set before the first paint (no flash of the wrong theme). It lives in the
 * header on wider screens and in the menu on phones. Runs on the public site, so no sign-in.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function toggle(page: Page) {
  const group = page.getByRole("radiogroup", { name: "Colour mode" }).filter({ visible: true });
  if (!(await group.count())) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  return page.getByRole("radiogroup", { name: "Colour mode" }).filter({ visible: true }).first();
}

test("switches, slides, saves across a reload and has no flash @layout", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/pricing");
  await settle(page);
  const group = await toggle(page);
  const radios = group.getByRole("radio");
  await expect(radios).toHaveCount(2);
  for (const r of await radios.all()) {
    const box = (await r.boundingBox())!;
    expect(box.height, "touch target").toBeGreaterThanOrEqual(43.5);
    expect(box.width, "touch target").toBeGreaterThanOrEqual(43.5);
  }
  const thumb = group.locator('[data-slot="color-mode-thumb"]');
  await radios.nth(0).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await radios.nth(1).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(thumb).toHaveCSS("transform", /matrix\(1, 0, 0, 1, \d+/);

  // Before any script runs, the saved choice is already on <html>
  await page.reload({ waitUntil: "commit" });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await settle(page);
  expect(await page.evaluate(() => localStorage.getItem("pp:theme"))).toBe("dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scroll").toBe(true);
});

test("works with the arrow keys and names every segment @a11y @layout", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/pricing");
  await settle(page);
  const group = await toggle(page);
  const light = group.getByRole("radio", { name: "Light" });
  const dark = group.getByRole("radio", { name: "Dark" });
  await light.click();
  await light.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dark).toBeFocused();
  await expect(dark).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("ArrowLeft");
  await expect(light).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // One tab stop for the whole group
  await expect(group.getByRole("radio").and(page.locator('[tabindex="0"]'))).toHaveCount(1);
});

test("respects reduced motion @layout", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/pricing");
  await settle(page);
  const group = await toggle(page);
  await expect(group.locator('[data-slot="color-mode-thumb"]')).toHaveCSS("transition-duration", "0s");
});
