import { expect, test, type Page } from "@playwright/test";
import { expectNoConsoleErrors, layoutIssues, prepare, report, settle } from "./helpers";

/**
 * Gate walkthroughs (Part 4 D, plus the earlier buyer journey). Each test drives the real UI the
 * way a person would, on phone and desktop sizes in all three engines.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function fillCheckout(page: Page) {
  await page.getByLabel("Full name").fill("Priya Sharma");
  await page.getByLabel("Email").fill("priya.flow@example.com");
  await page.getByRole("textbox", { name: /phone number/i }).fill("9876543210");
  await page.getByRole("checkbox", { name: /agree/i }).click();
}

test.describe("admin search @flow", () => {
  test("search an order, reveal the buyer's email, and see it in the audit log", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/admin");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").fill("#1042");
    const option = dialog.getByRole("option", { name: /PP-1042/ });
    await expect(option).toBeVisible();
    // Masked until revealed
    await expect(option).toContainText("••••@");
    const issues = await layoutIssues(page);
    expect(issues, report(issues)).toEqual([]);

    await dialog.getByRole("combobox").press("ControlOrMeta+Enter");
    await dialog.getByRole("group", { name: /Actions for PP-1042/ }).getByRole("button", { name: "Reveal email" }).click();
    const confirm = page.getByRole("dialog", { name: /Show this email/ });
    await confirm.getByLabel(/why do you need it/i).fill("Buyer asked for a resend");
    await confirm.getByRole("button", { name: "Reveal" }).click();
    await expect(dialog.getByRole("option", { name: /PP-1042/ })).toContainText(/@/);
    await expect(dialog.getByRole("option", { name: /PP-1042/ })).not.toContainText("••••");

    await page.keyboard.press("Escape");
    await page.goto("/admin/system/audit");
    await settle(page);
    await expect(page.getByText("Buyer asked for a resend").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Revealed email").filter({ visible: true }).first()).toBeVisible();
    await expectNoConsoleErrors(errors);
  });

  test("full results page with tabs and filters", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/admin/system/search?q=%40ananya");
    await settle(page);
    await expect(page.getByRole("tab", { name: /Orders/ })).toBeVisible();
    await page.getByRole("tab", { name: /Orders/ }).click();
    await expect(page).toHaveURL(/type=order/);
    await expect(page.getByRole("tabpanel")).toContainText("PP-");
    await expectNoConsoleErrors(errors);
  });

  test("creator search only covers their own store", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/dashboard");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await dialog.getByRole("combobox").fill("freelance");
    await expect(dialog.getByText(/Freelance Pricing Playbook/).first()).toBeVisible();
    // Inkwell's "The Quiet Freelancer" belongs to another store
    await expect(dialog.getByText("The Quiet Freelancer")).toHaveCount(0);
  });
});

test.describe("deal paths @flow", () => {
  test("buyer builds a deal, picks a gift, pays; the creator's stats move", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/store_ananya/offers/deal-paths");
    await settle(page);
    const usesBefore = Number((await page.getByRole("row", { name: /Second Brain \+ Pricing Playbook/ }).or(page.getByRole("listitem").filter({ hasText: "Second Brain + Pricing Playbook" })).first().innerText()).match(/\b(\d{3,})\b/)?.[1] ?? "0");

    await page.goto("/s/ananya/second-brain-for-founders");
    await settle(page);
    await page.getByRole("button", { name: /buy now/i }).first().click();
    await page.waitForURL(/\/checkout\//);
    await settle(page);

    const panel = page.getByRole("region", { name: "Build your deal" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("meter", { name: "Savings" })).toBeVisible();
    const payButton = page.getByRole("button", { name: /^Pay/ }).filter({ visible: true }).first();
    // Desktop: the inline button keeps its place on the page. Phones: the fixed bar keeps its place on screen.
    const pageY = () =>
      payButton.evaluate((el) => {
        let fixed = false;
        for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") fixed = true;
        return el.getBoundingClientRect().top + (fixed ? 0 : window.scrollY);
      });
    const before = await pageY();

    await panel.getByRole("button", { name: /Add The Freelance Pricing Playbook/ }).click();
    await expect(panel.getByText(/You're saving/)).toBeVisible();
    // The Pay button didn't move
    expect(Math.abs((await pageY()) - before)).toBeLessThan(2);

    // Gift unlocked over ₹1,500: pick one
    await panel.getByRole("radio").first().click();
    await expect(page.getByRole("region", { name: "Order summary" })).toContainText("Free");
    await expect(page.getByRole("region", { name: "Order summary" })).toContainText("Deal savings");
    const issues = await layoutIssues(page);
    expect(issues, report(issues)).toEqual([]);

    await fillCheckout(page);
    await page.getByRole("button", { name: /^Pay/ }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: /approve payment/i }).click();
    await page.waitForURL(/\/success\//);

    await page.goto("/store/store_ananya/offers/deal-paths");
    await settle(page);
    const usesAfter = Number((await page.getByRole("row", { name: /Second Brain \+ Pricing Playbook/ }).or(page.getByRole("listitem").filter({ hasText: "Second Brain + Pricing Playbook" })).first().innerText()).match(/\b(\d{3,})\b/)?.[1] ?? "0");
    expect(usesAfter).toBe(usesBefore + 1);
    await expectNoConsoleErrors(errors);
  });

  test("skip hides deals in one click and can be undone", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/s/ananya/second-brain-for-founders");
    await settle(page);
    await page.getByRole("button", { name: /buy now/i }).first().click();
    await page.waitForURL(/\/checkout\//);
    await settle(page);
    await page.getByRole("region", { name: "Build your deal" }).getByRole("button", { name: "No thanks" }).click();
    await expect(page.getByRole("button", { name: "Show deals" })).toBeVisible();
    await page.getByRole("button", { name: "Show deals" }).click();
    await expect(page.getByRole("region", { name: "Build your deal" })).toBeVisible();
  });

  test("creator builds a rule with the wizard, previews it and saves", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/store_ananya/offers/deal-paths/new");
    await settle(page);
    await page.getByRole("radio", { name: /Order total reaches/ }).click();
    await page.getByRole("button", { name: /^Next/ }).click();
    await expect(page.getByText("Enter an amount of at least ₹1.")).toBeVisible();
    await page.getByRole("textbox", { name: /Order total of at least/ }).fill("2000");
    await page.getByRole("button", { name: /^Next/ }).click();
    await page.getByRole("textbox", { name: "Percent off", exact: true }).fill("15");
    await page.getByRole("button", { name: /^Next/ }).click();
    await page.getByRole("textbox", { name: /Name \(only you see this\)/ }).fill("Big basket 15%");
    // Live preview reacts to the rule
    await page.getByRole("region", { name: "Test mode" }).or(page.locator("section[aria-labelledby=dp-heading]")).first().getByRole("checkbox").nth(1).click();
    await page.getByRole("button", { name: "Save deal path" }).click();
    await page.waitForURL(/\/store\/offers\/deal-paths\/dr_/);
    await expect(page.getByRole("heading", { name: "Big basket 15%" })).toBeVisible();
    await page.goto("/store/store_ananya/offers/deal-paths");
    await settle(page);
    await expect(page.getByText("Big basket 15%").filter({ visible: true }).first()).toBeVisible();
    await expectNoConsoleErrors(errors);
  });
});

test.describe("visual editor @flow", () => {
  test("edit, undo, add a block, publish, see it live, restore a version", async ({ page }, testInfo) => {
    const { errors } = await prepare(page, testInfo);
    await page.goto("/store/store_ananya/design/pages/vp_ananya_about-ananya/edit");
    await settle(page);
    const canvas = page.getByRole("region", { name: "Page canvas" });
    await canvas.locator("h1").first().click();
    await expect(canvas.locator("[data-node-type=hero]")).toHaveClass(/outline-2/);
    await expect(page.getByRole("toolbar", { name: /Hero actions/ })).toBeVisible();

    if (isPhone(page)) await page.getByRole("button", { name: "Edit", exact: true }).click();
    const headline = page.getByRole("textbox", { name: "Headline", exact: true }).filter({ visible: true });
    await headline.fill("Made slowly, with care");
    // The bottom sheet is modal on phones; close it to look at the canvas
    if (isPhone(page)) await page.keyboard.press("Escape");
    await expect(canvas.locator("h1").first()).toHaveText("Made slowly, with care");

    await page.getByRole("button", { name: /^Undo/ }).click();
    await expect(canvas.locator("h1").first()).not.toHaveText("Made slowly, with care");
    await page.getByRole("button", { name: /^Redo/ }).click();
    await expect(canvas.locator("h1").first()).toHaveText("Made slowly, with care");

    // Add a button block after the selection
    if (isPhone(page)) await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: /^Add Section/ }).click();
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 8000 });

    // Device switch
    if (!isPhone(page)) {
      await page.getByRole("button", { name: "Phone preview" }).first().click();
      await expect(page.getByRole("button", { name: "Phone preview" }).first()).toHaveAttribute("aria-pressed", "true");
    }

    await page.getByRole("button", { name: /Publish changes/ }).click();
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
    // Part 6F: Publish only shows while the draft differs from the live page
    await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Publish/ })).toHaveCount(0);

    await page.goto("/s/ananya/p/about-ananya");
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: "Made slowly, with care" })).toBeVisible();

    await page.goto("/store/store_ananya/design/pages/vp_ananya_about-ananya/versions");
    await settle(page);
    await expect(page.getByRole("listitem").filter({ hasText: "Live now" })).toBeVisible();
    await page.getByRole("button", { name: "Restore" }).nth(1).click();
    await page.getByRole("button", { name: "Restore to draft" }).click();
    await page.waitForURL(/\/edit$/);
    await settle(page);
    await expect(page.getByRole("region", { name: "Page canvas" }).locator("h1").first()).not.toHaveText("Made slowly, with care");
    await expectNoConsoleErrors(errors);
  });

  test("new page from a template, and the 5 MB image limit", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto("/store/store_ananya/design/pages");
    await settle(page);
    await page.getByRole("button", { name: "New page" }).first().click();
    await page.getByLabel("Page name").fill("Launch week");
    await page.getByRole("radio", { name: /Product launch/ }).click();
    await page.getByRole("button", { name: "Create and edit" }).click();
    await page.waitForURL(/\/edit$/);
    await settle(page);
    const canvas = page.getByRole("region", { name: "Page canvas" });
    await expect(canvas.locator("[data-node-type=hero]")).toBeVisible();

    // Add an image block and try a file that's too big
    if (isPhone(page)) await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: /^Add Image/ }).click();
    if (isPhone(page)) await page.getByRole("button", { name: "Edit", exact: true }).click();
    const scope = isPhone(page) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Block settings" });
    await scope.locator('input[type=file]').first().setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 10) });
    await expect(page.getByRole("alert").filter({ hasText: /Images can be up to 5 MB/ })).toBeVisible();
  });
});

test.describe("buyer journey @flow", () => {
  test("zero total skips payment", async ({ page }, testInfo) => {
    await prepare(page, testInfo, { stress: true });
    await page.goto("/s/ananya/the-freelance-pricing-playbook");
    await settle(page);
    await page.getByRole("button", { name: /buy now/i }).first().click();
    await page.waitForURL(/\/checkout\//);
    await settle(page);
    await page.getByRole("button", { name: /have a coupon/i }).click();
    await page.getByLabel("Coupon code").fill("DIWALIMEGAFESTIVESALE2026EXTRA100PERCENTOFF");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page.getByRole("button", { name: /get it now/i }).filter({ visible: true }).first()).toBeVisible();
    await fillCheckout(page);
    await page.getByRole("button", { name: /get it now/i }).filter({ visible: true }).first().click();
    await page.waitForURL(/\/success\//);
  });
});
