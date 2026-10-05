import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Screen matrix from QA Part 5. Layout checks run on every size in all three engines;
 * flows, accessibility and visual snapshots run on a representative subset.
 * Needs a production build: `npm run build` first (test:all does it).
 */
const PORT = 3100;

export const SIZES: [string, number, number, "phone" | "tablet" | "desktop"][] = [
  ["320x568", 320, 568, "phone"],
  ["360x640", 360, 640, "phone"],
  ["375x667", 375, 667, "phone"],
  ["390x844", 390, 844, "phone"],
  ["414x896", 414, 896, "phone"],
  ["430x932", 430, 932, "phone"],
  ["667x375", 667, 375, "phone"],
  ["844x390", 844, 390, "phone"],
  ["768x1024", 768, 1024, "tablet"],
  ["820x1180", 820, 1180, "tablet"],
  ["1024x768", 1024, 768, "tablet"],
  ["1280x720", 1280, 720, "desktop"],
  ["1366x768", 1366, 768, "desktop"],
  ["1440x900", 1440, 900, "desktop"],
  ["1536x864", 1536, 864, "desktop"],
  ["1920x1080", 1920, 1080, "desktop"],
  ["2560x1440", 2560, 1440, "desktop"],
];

const ENGINES = [
  { name: "chromium", device: devices["Desktop Chrome"] },
  { name: "firefox", device: devices["Desktop Firefox"] },
  { name: "webkit", device: devices["Desktop Safari"] },
] as const;

const FLOW_PROJECTS = ["chromium-390x844", "chromium-1280x720", "firefox-1280x720", "webkit-390x844"];
const A11Y_PROJECTS = ["chromium-390x844", "chromium-1280x720"];
const STRESS_PROJECTS = ["chromium-320x568", "chromium-390x844", "chromium-768x1024", "chromium-1280x720", "firefox-1280x720", "webkit-390x844"];

const matrix: Project[] = ENGINES.flatMap(({ name, device }) =>
  SIZES.map(([label, width, height, kind]) => {
    const projectName = `${name}-${label}`;
    const tags = ["@layout"];
    if (FLOW_PROJECTS.includes(projectName)) tags.push("@flow");
    if (A11Y_PROJECTS.includes(projectName)) tags.push("@a11y");
    if (STRESS_PROJECTS.includes(projectName)) tags.push("@stress");
    return {
      name: projectName,
      grep: new RegExp(tags.join("|")),
      use: {
        ...device,
        viewport: { width, height },
        // Firefox doesn't support isMobile; touch matters for tap-target rules only
        ...(name !== "firefox" && kind !== "desktop" ? { isMobile: true, hasTouch: true } : {}),
        deviceScaleFactor: kind === "phone" && name !== "firefox" ? 2 : 1,
      },
      metadata: { kind },
    } satisfies Project;
  })
);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  // Baselines are per platform: fonts rasterise differently on Windows, macOS and Linux
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}-{platform}{ext}",
  fullyParallel: true,
  workers: process.env.CI ? 4 : 8,
  // One retry absorbs browser-process crashes under load; anything that only passes on retry is reported as flaky
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" } },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    ...matrix,
    // Browser zoom 200% at 1280 width behaves like a 640px CSS viewport at 2x
    { name: "chromium-zoom200", grep: /@layout/, use: { ...devices["Desktop Chrome"], viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 } },
    // Large system text: root font size at 150%
    { name: "chromium-largetext", grep: /@layout/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, metadata: { largeText: true, kind: "phone" } },
    { name: "visual-mobile", grep: /@visual/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: "visual-tablet", grep: /@visual/, use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 } },
    { name: "visual-desktop", grep: /@visual/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  ],
});
