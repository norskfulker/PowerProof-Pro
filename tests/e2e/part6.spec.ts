import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoConsoleErrors, layoutIssues, prepare, report, settle } from "./helpers";

/**
 * Part 6 gate (section H). Each test drives the real UI on phone and desktop sizes in all three
 * engines: media uploads, backgrounds, per-store pages, plan limits, AI images, save bars and the
 * getting-started tracker.
 */

// 1×1 PNG and a few bytes labelled as MP4: enough for the mock upload and library
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const image = (name = "cover.png") => ({ name, mimeType: "image/png", buffer: PNG });
const video = (name = "loop.mp4") => ({ name, mimeType: "video/mp4", buffer: Buffer.from("00000018667479706d703432", "hex") });

const saveBar = (page: Page) => page.getByRole("region", { name: "Unsaved changes" });

/** Unsupported fake video bytes make the browser log a media error; nothing else may. */
const ignoreMediaNoise = (errors: string[]) => errors.filter((e) => !/media|MEDIA_ERR|video|Failed to load resource|DEMUXER|NotSupportedError|no supported source/i.test(e));

async function upload(scope: Page | Locator, label: string | RegExp, file: { name: string; mimeType: string; buffer: Buffer }) {
  await scope.getByLabel(typeof label === "string" ? `Upload ${label}` : label).first().setInputFiles(file);
}

async function saveAndExpectHidden(page: Page) {
  await expect(saveBar(page)).toBeVisible();
  await saveBar(page).getByRole("button", { name: "Save changes" }).click();
  await expect(saveBar(page)).toBeHidden({ timeout: 10_000 });
}

test.describe("media uploads @flow", () => {
  test("image and video on the store hero, then on a product", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/design");
    await settle(page);
    await expect(saveBar(page)).toBeHidden();

    await page.getByRole("tab", { name: "Hero" }).click();
    await page.getByRole("switch", { name: "Hero background image or video" }).click();
    const picker = page.getByRole("group", { name: "Hero background: type" });
    await upload(page, "Image", image("hero.png"));
    await expect(page.getByRole("button", { name: "Replace" }).first()).toBeVisible({ timeout: 10_000 });

    await picker.getByRole("button", { name: "Video" }).click();
    await upload(page, "Video (loops, muted)", video("hero.mp4"));
    await upload(page, "Still poster", image("poster.png"));
    await expect(page.getByRole("button", { name: "Replace" })).toHaveCount(2, { timeout: 10_000 });
    await saveAndExpectHidden(page);

    await page.goto("/products/prod_01");
    await settle(page);
    await expect(saveBar(page)).toBeHidden();
    const list = page.getByRole("list", { name: "Product images, in order" });
    const before = await list.getByRole("listitem").count();
    await upload(page, /^Upload Add (another|the cover) image/, image("extra.png"));
    await expect(list.getByRole("listitem")).toHaveCount(before + 1, { timeout: 10_000 });
    const replaces = await page.getByRole("button", { name: "Replace" }).count();
    await upload(page, "Product video", video("demo.mp4"));
    await expect(page.getByRole("button", { name: "Replace" })).toHaveCount(replaces + 1, { timeout: 10_000 });
    await saveAndExpectHidden(page);

    await page.goto("/media");
    await settle(page);
    const files = page.getByRole("list", { name: "Files" });
    await expect(files.getByRole("button", { name: /hero, Image/ })).toBeVisible();
    await expect(files.getByRole("button", { name: /demo, Video/ })).toBeVisible();
    await files.getByRole("button", { name: /extra, Image/ }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /Product image/ })).toBeVisible();

    const issues = await layoutIssues(page);
    expect(issues, report(issues)).toEqual([]);
    await expectNoConsoleErrors(ignoreMediaNoise(errors));
  });

  test("collection tile switches between colour and image with a live preview", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/collections");
    await settle(page);
    await page.getByRole("button", { name: /^Edit / }).first().click();
    const sheet = page.getByRole("dialog");
    const preview = sheet.getByRole("group", { name: "Live preview" });
    await expect(preview.locator("img")).toHaveCount(0);

    await sheet.getByRole("group", { name: "Tile: type" }).getByRole("button", { name: "Image" }).click();
    await upload(sheet, "Image", image("tile.png"));
    await expect(preview.locator("img")).toHaveCount(1, { timeout: 10_000 });
    await expect(saveBar(page)).toBeVisible();

    await sheet.getByRole("group", { name: "Tile: type" }).getByRole("button", { name: "Colour" }).click();
    await sheet.getByRole("radiogroup", { name: "Theme colours" }).getByRole("radio").nth(2).click();
    await expect(preview.locator("img")).toHaveCount(0);
    await saveAndExpectHidden(page);
    await expectNoConsoleErrors(errors);
  });
});

test.describe("per-store pages @flow", () => {
  test("switching stores shows each store's own About, FAQ and policies", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/store_ananya/pages/about");
    await settle(page);
    const storyA = await page.getByLabel("Your story").inputValue();

    await page.getByRole("button", { name: /Switch store/ }).click();
    await page.getByRole("menuitem", { name: /Ananya Photo Presets/ }).click();
    await expect(page.getByRole("button", { name: /Store: Ananya Photo Presets/ })).toBeVisible({ timeout: 10_000 });

    await page.goto("/store/store_ananya_photo/pages/about");
    await settle(page);
    await expect(page.getByLabel("Your story")).not.toHaveValue(storyA);

    await page.goto("/store/store_ananya_photo/pages/policies/refund");
    await settle(page);
    const refundB = await page.getByRole("textbox", { name: "Refund policy" }).inputValue();
    await page.goto("/store/store_ananya/pages/policies/refund");
    await settle(page);
    await expect(page.getByRole("textbox", { name: "Refund policy" })).not.toHaveValue(refundB);

    // Edit one store's FAQ; the save bar behaves and the other store is untouched
    await page.goto("/store/store_ananya_photo/pages/faq");
    await settle(page);
    await expect(saveBar(page)).toBeHidden();
    const q1 = page.getByRole("textbox", { name: "Question 1" });
    const original = await q1.inputValue();
    await q1.fill(`${original} (updated)`);
    await expect(saveBar(page)).toBeVisible();
    await q1.fill(original);
    await expect(saveBar(page)).toBeHidden();
    await q1.fill(`${original} (updated)`);
    await saveAndExpectHidden(page);

    await page.goto("/s/ananya/faq");
    await settle(page);
    await expect(page.getByText(`${original} (updated)`)).toHaveCount(0);
    await expectNoConsoleErrors(errors);
  });
});

test.describe("free plan and getting started @flow", () => {
  test("new account: 0%, first product works, second product and store ask to upgrade, progress resumes", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    const email = `meera.${testInfo.project.name.replace(/\W/g, "")}@example.com`;
    await page.goto("/signup");
    await settle(page);
    await page.getByLabel("Your name").fill("Meera Rao");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /create|sign up|start/i }).click();
    await page.waitForURL(/verify-email/);
    await settle(page);

    await page.goto("/dashboard");
    await settle(page);
    const welcome = page.getByRole("dialog", { name: /Welcome to PowerProof/ });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("listitem")).toHaveCount(3);
    await welcome.getByRole("button", { name: "Later" }).click();
    await expect(page.getByRole("img", { name: "Setup progress: 0%" }).first()).toBeVisible();

    await page.goto(`/verify-email?email=${encodeURIComponent(email)}`);
    await settle(page);
    await page.getByLabel("Code").fill("123456");
    await page.getByRole("button", { name: "Confirm email" }).click();
    await page.waitForURL(/onboarding/);
    await settle(page);

    // First product: allowed on Free
    await page.goto("/products/new/upload");
    await settle(page);
    await page.getByLabel("Title").fill("Calm Desk Planner");
    await page.getByLabel("Description").fill("A printable planner for slow, focused weeks. Twelve pages, A4 and Letter.");
    await page.getByRole("button", { name: "Create product" }).click();
    await page.waitForURL(/\/products$/);

    // Second product: the Upgrade dialog, never a silent block
    await settle(page);
    await page.getByRole("link", { name: /Add product/ }).first().click();
    const upgrade = page.getByRole("dialog", { name: /Upgrade to Pro/ });
    await expect(upgrade).toBeVisible();
    await expect(upgrade).toContainText("$20");
    await upgrade.getByRole("button", { name: "Not now" }).click();
    await expect(upgrade).toBeHidden();

    // Second store: same
    await page.getByRole("button", { name: /Switch store/ }).click();
    await page.getByRole("menuitem", { name: /Add another store/ }).click();
    await expect(page.getByRole("dialog", { name: /Upgrade to Pro/ })).toBeVisible();
    await page.getByRole("dialog", { name: /Upgrade to Pro/ }).getByRole("button", { name: "Not now" }).click();

    // Progress moved, and survives signing out and back in
    await page.goto("/dashboard");
    await settle(page);
    const ring = page.getByRole("img", { name: /Setup progress: \d+%/ }).first();
    const label = await ring.getAttribute("aria-label");
    expect(label).not.toBe("Setup progress: 0%");
    await page.evaluate(() => localStorage.removeItem("pp:session"));
    await page.goto("/login");
    await settle(page);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/dashboard/);
    await settle(page);
    await expect(page.getByRole("img", { name: label! }).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Welcome to PowerProof/ })).toBeHidden();
    await expectNoConsoleErrors(errors);
  });
});

test.describe("AI images @flow", () => {
  test.setTimeout(120_000);
  test("from a hero field: generate, regenerate, edit, use, and find it in the library", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/design");
    await settle(page);
    await page.getByRole("tab", { name: "Hero" }).click();
    await page.getByRole("switch", { name: "Hero background image or video" }).click();
    await page.getByRole("button", { name: "Create with AI" }).first().click();

    const panel = page.getByRole("dialog", { name: /Create with AI|AI image/i });
    await expect(panel).toBeVisible();
    await panel.getByLabel("Describe the image").fill("Illustrated hills at dusk for a study notes store");
    await panel.getByRole("button", { name: /Generate 4 images/ }).click();
    await expect(panel.getByRole("button", { name: "Cancel" })).toBeVisible();
    const pick = panel.getByRole("radiogroup", { name: "Pick an image" });
    await expect(pick.getByRole("radio")).toHaveCount(4, { timeout: 20_000 });

    await panel.getByRole("button", { name: "Regenerate" }).click();
    await expect(panel.getByRole("button", { name: "Regenerate" })).toBeEnabled({ timeout: 20_000 });
    await panel.getByLabel("Edit by instruction").fill("make the sky warmer");
    await panel.getByRole("button", { name: "Apply" }).click();
    await expect(panel.getByRole("button", { name: "Apply" })).toBeEnabled({ timeout: 20_000 });

    await panel.getByRole("button", { name: /Use this image/ }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Replace" }).first()).toBeVisible();
    await saveAndExpectHidden(page);

    await page.goto("/media");
    await settle(page);
    await page.getByRole("group", { name: "File type" }).getByRole("button", { name: "Made with AI" }).click();
    await expect(page.getByRole("list", { name: "Files" }).getByRole("button", { name: /Illustrated hills/ }).first()).toBeVisible();
    await expectNoConsoleErrors(errors);
  });
});

test.describe("save bars @flow", () => {
  // Every editable screen: hidden on load, shows on edit, hides on revert, warns on leaving
  const SCREENS: { path: string; field: (p: Page) => Locator }[] = [
    { path: "/settings/profile", field: (p) => p.getByLabel(/Your name|Name/).first() },
    { path: "/settings/store", field: (p) => p.getByLabel("Store name") },
    { path: "/settings/company", field: (p) => p.getByLabel(/Legal name/) },
    { path: "/settings/tax", field: (p) => p.getByLabel("Footer note") },
    { path: "/store/seo", field: (p) => p.getByLabel("Page title") },
    { path: "/store/store_ananya/pages/about", field: (p) => p.getByLabel("Your story") },
    { path: "/pages/page_launch/edit", field: (p) => p.getByLabel("Page name") },
  ];
  for (const s of SCREENS) {
    test(`save bar on ${s.path}`, async ({ page }, testInfo) => {
      const { errors } = await prepare(page, testInfo);
      await page.goto(s.path);
      await settle(page);
      await expect(saveBar(page)).toBeHidden();
      const field = s.field(page);
      const original = await field.inputValue();
      await field.fill(`${original} x`);
      await expect(saveBar(page)).toBeVisible();
      await field.fill(original);
      await expect(saveBar(page)).toBeHidden();

      await field.fill(`${original} x`);
      await page.getByRole("link", { name: "Orders" }).first().click({ trial: isPhoneNav(page) }).catch(() => {});
      if (!isPhoneNav(page)) {
        await expect(page.getByRole("dialog", { name: "Leave without saving?" })).toBeVisible();
        await page.getByRole("button", { name: "Stay" }).click();
        await expect(page).toHaveURL(new RegExp(s.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
      await saveAndExpectHidden(page);
      await expectNoConsoleErrors(errors);
    });
  }
});

test.describe("save bars @flow", () => {
  test("save bar on a deal path", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/offers/deal-paths/dr_ananya_pair");
    await settle(page);
    await expect(saveBar(page)).toBeHidden();
    // The wizard's product list comes before the test-mode preview's
    const box = page.getByRole("checkbox", { name: /Monsoon Moods/ }).first();
    await box.click();
    await expect(saveBar(page)).toBeVisible();
    await box.click();
    await expect(saveBar(page)).toBeHidden();
    await box.click();
    await saveAndExpectHidden(page);
    await expectNoConsoleErrors(errors);
  });
});

/** The sidebar (with the Orders link) is collapsed on phones */
function isPhoneNav(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 1024;
}
