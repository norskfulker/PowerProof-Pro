import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { STATE } from "./support/manifest";

/**
 * The store editor on the home page, Shopify-style: the section tree on the left, the page in a
 * frame in the middle (text is typed straight into it), settings for the selection on the right.
 * Nothing reaches buyers until Publish, so every test discards its draft.
 */
test.use({ storageState: STATE.A });

async function open(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo) {
  await prepare(page, testInfo);
  await page.goto("/store/current/design/pages/home/edit");
  await settle(page);
  const canvas = page.frameLocator('iframe[title="Page editor canvas"]');
  await expect(canvas.locator("[data-node-type=hero]").first()).toBeVisible({ timeout: 20_000 });
  return canvas;
}

const discard = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Discard" }).click().then(() => page.getByRole("button", { name: "Discard changes" }).click()).catch(() => undefined);

test("text is typed straight into the page and the settings follow @flow", async ({ page }, testInfo) => {
  const canvas = await open(page, testInfo);
  const headline = canvas.getByRole("textbox", { name: "Headline" }).first();
  await headline.click();
  await headline.press("End");
  await headline.pressSequentially(" e2e typed");
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(/e2e typed$/);
  await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 10_000 });
  await discard(page);
});

test("sections are added from presets and get a colour scheme @flow", async ({ page }, testInfo) => {
  const canvas = await open(page, testInfo);
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Add section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Cards/ }).click();
  await expect(canvas.locator("[data-node-type=card]")).toHaveCount(3);
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByRole("radio", { name: "Ink" }).click();
  await expect(canvas.locator("section.pp-scheme-scheme-5")).toBeVisible();
  await discard(page);
});

test("the header and theme settings are part of the editor @flow", async ({ page }, testInfo) => {
  const canvas = await open(page, testInfo);
  await canvas.locator('[data-node-id="@header"]').click();
  await expect(page.getByText("Part of every page of your store")).toBeVisible();
  await page.getByRole("tab", { name: "Theme" }).click();
  await page.getByRole("button", { name: "Colour schemes" }).click();
  await expect(page.getByRole("button", { name: /Brand/ }).first()).toBeVisible();
});
