import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { buildRoutes } from "./routes";
import { readManifest } from "./support/manifest";

/** axe-core on every route: zero serious or critical issues. */
for (const route of buildRoutes(readManifest())) {
  test.describe(route.path, () => {
    if (route.signedOut) test.use({ storageState: { cookies: [], origins: [] } });

    test(`a11y ${route.path} @a11y`, async ({ page }, testInfo) => {
      await prepare(page, testInfo);
      await page.goto(route.path);
      await settle(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .options({ iframes: false })
        .exclude("iframe[sandbox]")
        .analyze();
      const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
      expect(bad, summary).toEqual([]);
    });
  });
}
