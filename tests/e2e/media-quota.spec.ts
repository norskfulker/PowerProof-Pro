import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { STATE } from "./support/manifest";

/** The media library: a 2 GB meter for the store, and photos shrunk on upload. */
test.use({ storageState: STATE.A });

// A 3000×2000 noisy PNG, so it is large enough for WebP to beat it
async function bigPng(page: import("@playwright/test").Page) {
  const base64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 3000;
    c.height = 2000;
    const g = c.getContext("2d")!;
    const img = g.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (i / 4) % 251;
      img.data[i] = v; img.data[i + 1] = (v * 7) % 255; img.data[i + 2] = (v * 13) % 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

test("shows how much of 2 GB is used @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/catalog/media");
  await settle(page);
  const meter = page.getByRole("meter", { name: "Media storage used" });
  await expect(meter).toBeVisible();
  await expect(page.getByText(/of 2 GB used/)).toBeVisible();
});

test("a big photo is shrunk, stored smaller, and the meter moves @flow", async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.goto("/catalog/media");
  await settle(page);
  const before = Number(await page.getByRole("meter", { name: "Media storage used" }).getAttribute("aria-valuenow"));
  const png = await bigPng(page);
  await page.getByRole("button", { name: /^Upload$/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "e2e-big-photo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Shrunk to/)).toBeVisible({ timeout: 30_000 });
  const after = Number(await page.getByRole("meter", { name: "Media storage used" }).getAttribute("aria-valuenow"));
  expect(after - before).toBeGreaterThan(0);
  expect(after - before).toBeLessThan(png.length);
});
