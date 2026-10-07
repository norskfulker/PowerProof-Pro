import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { loadTestEnv, need } from "./support/env";
import { DIR, MANIFEST, STATE } from "./support/manifest";
import { seed } from "./support/seed";
import { creds, type Who } from "./support/supabase";

/** Seeds creator A's store, then signs both test creators in through the real login page. */
export default async function globalSetup(config: FullConfig) {
  loadTestEnv();
  need("NEXT_PUBLIC_SUPABASE_URL");
  need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  fs.mkdirSync(DIR, { recursive: true });

  const manifest = await seed(Date.now().toString(36));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3100";
  const browser = await chromium.launch();
  try {
    for (const who of ["A", "B"] as Who[]) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto("/login");
      const { email, password } = creds(who);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await page.waitForURL("**/dashboard", { timeout: 30_000 });
      await context.storageState({ path: STATE[who] });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
