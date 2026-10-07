import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, layoutIssues, prepare, report, settle } from "./helpers";
import { buildRoutes } from "./routes";
import { readManifest } from "./support/manifest";

/** QA Part 5 D: every route, every size, every engine, on creator A's real data. */
for (const route of buildRoutes(readManifest())) {
  test.describe(route.path, () => {
    if (route.signedOut) test.use({ storageState: { cookies: [], origins: [] } });

    test(`layout ${route.path} @layout`, async ({ page }, testInfo) => {
      const { errors } = await prepare(page, testInfo);
      await page.goto(route.path);
      await settle(page);
      const issues = await layoutIssues(page);
      expect(issues, report(issues)).toEqual([]);
      // The 404 and 500 pages log their own document status; that's expected
      await expectNoConsoleErrors(errors.filter((e) => !(route.expectStatus && e.includes(`status of ${route.expectStatus}`))));
    });
  });
}
