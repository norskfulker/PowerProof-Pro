import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { prepare, settle } from "./helpers";
import { ROUTES } from "./routes";

/** axe-core on every route: zero serious or critical issues. */
for (const route of ROUTES) {
  test(`a11y ${route.path} @a11y`, async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.goto(route.path);
    await settle(page);
    // Sandboxed email previews can't run axe inside; their HTML is checked in emails.spec.ts.
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .options({ iframes: false })
      .exclude("iframe[sandbox]")
      .analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
    expect(bad, summary).toEqual([]);
  });
}
