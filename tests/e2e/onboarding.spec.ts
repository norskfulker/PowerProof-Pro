import { expect, test, type Page } from "@playwright/test";
import { creds } from "./support/supabase";
import { signInAs } from "./support/supabase";
import { readManifest } from "./support/manifest";

/**
 * Store creation is the one mandatory onboarding step. Creator B is used as the brand-new user:
 * each test starts with B's store removed (B never owns data, so that is safe) and the suite puts
 * a store back at the end. Run with `npm run test:onboarding`, on its own: it empties B's account.
 */
test.describe.configure({ mode: "serial" });

const NAME = "e2e Onboarding Test";

async function removeStores() {
  const { client, userId } = await signInAs("B");
  const r = await client.from("stores").delete().eq("owner_id", userId);
  if (r.error) throw new Error(`Couldn't empty creator B: ${r.error.message}`);
  return { client, userId };
}

async function storesOfB() {
  const { client, userId } = await signInAs("B");
  const r = await client.from("stores").select("id, name, slug, status, brand_color").eq("owner_id", userId);
  if (r.error) throw new Error(r.error.message);
  return { client, userId, rows: r.data };
}

async function fillName(page: Page, value: string) {
  const input = page.getByLabel("Store name");
  await input.fill(value);
  await input.blur();
}

test.beforeEach(async () => {
  await removeStores();
});

test.afterAll(async () => {
  // Leave B the way the other specs expect: an empty account with one store
  const { client, userId } = await removeStores();
  const r = await client.from("stores").insert({ owner_id: userId, name: "Test store B", slug: `e2e-b-${readManifest().tag}`, tagline: "A test store." });
  if (r.error) throw new Error(`Couldn't put creator B's store back: ${r.error.message}`);
});

test("a creator without a store is forced to /onboarding and can't reach anything else @onboarding", async ({ page }) => {
  for (const path of ["/dashboard", "/getting-started", "/catalog/products", "/sales/orders", "/settings/billing", "/store/current/design/base"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Create your store" })).toBeVisible();
    // Nothing from the creator shell: no sidebar tree, no tab bar, no search
    await expect(page.getByRole("tree")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  }
  // Client-side navigation can't get out either
  await page.goto("/onboarding");
  await page.evaluate(() => window.history.pushState({}, "", "/dashboard"));
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("invalid store names show an error and can't be submitted @onboarding", async ({ page }) => {
  await page.goto("/onboarding");
  const create = page.getByRole("button", { name: "Create store" });
  await expect(create).toBeDisabled();
  for (const [bad, message] of [
    ["Shop!", /letters, numbers, spaces and dashes only/i],
    ["Shop & Co", /letters, numbers, spaces and dashes only/i],
    ["A", /give your store a name/i],
    ["a".repeat(75), /under 75 characters/i],
  ] as const) {
    await fillName(page, bad);
    await expect(page.getByText(message)).toBeVisible();
    await expect(create).toBeDisabled();
  }
  await expect(page).toHaveURL(/\/onboarding$/);
  expect((await storesOfB()).rows).toHaveLength(0);
});

test("a valid name shows the link before confirming, saves a #RRGGBB colour and lands on the dashboard @onboarding", async ({ page }) => {
  await page.goto("/onboarding");
  await fillName(page, `  ${NAME.replace(" ", "    ")}  `);
  // The link is made by the database and shown before anything is saved
  const link = page.getByText(/\/e2e-onboarding-test/);
  await expect(link).toBeVisible();
  await expect(page.getByLabel("Available")).toBeVisible();
  const shown = (await link.textContent())!.split("/").pop()!;
  await page.getByLabel("Pick any colour").fill("#aa22cc");
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("tree", { name: "Main" })).toBeVisible();

  const { rows } = await storesOfB();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: NAME, slug: shown, brand_color: "#AA22CC", status: "draft" });
  // Onboarding is closed to a creator who has a store
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a second login in a fresh browser isn't asked to onboard again @onboarding", async ({ browser }) => {
  const { client, userId } = await signInAs("B");
  await client.from("stores").insert({ owner_id: userId, name: NAME, slug: `e2e-fresh-${Date.now().toString(36)}`, brand_color: "#0F3D33" });
  const context = await browser.newContext({ baseURL: "http://localhost:3100", storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  const { email, password } = creds("B");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/catalog/products");
  await expect(page).toHaveURL(/\/catalog\/products$/);
  expect(await page.evaluate(() => window.localStorage.length)).toBeGreaterThan(0); // set by this login, not carried over
  await context.close();
});

test("a Hindi store name still gets a working link @onboarding", async ({ page, browser }) => {
  await page.goto("/onboarding");
  await fillName(page, "आदित्य की दुकान");
  await expect(page.getByLabel("Available")).toBeVisible();
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const { client, rows } = await storesOfB();
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe("आदित्य की दुकान");
  expect(rows[0].slug).toMatch(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/);
  // Publish it and open the link as a buyer
  const up = await client.from("stores").update({ status: "published" }).eq("id", rows[0].id);
  expect(up.error).toBeNull();
  const buyer = await browser.newContext({ baseURL: "http://localhost:3100", storageState: { cookies: [], origins: [] } });
  const bp = await buyer.newPage();
  await bp.goto(`/s/${rows[0].slug}`);
  await expect(bp.getByText("आदित्य की दुकान").first()).toBeVisible();
  await buyer.close();
});
