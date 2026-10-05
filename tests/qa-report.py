"""
Builds QA_REPORT.md from the Playwright JSON results and the Vitest JSON results.

    npx playwright test --reporter=json > test-results/full.json   (or PLAYWRIGHT_JSON_OUTPUT_NAME)
    npx vitest run --reporter=json --outputFile=test-results/vitest.json
    python tests/qa-report.py test-results/full.json test-results/vitest.json
"""
import collections
import datetime
import io
import json
import re
import sys

pw_path = sys.argv[1] if len(sys.argv) > 1 else "test-results/full.json"
vt_path = sys.argv[2] if len(sys.argv) > 2 else "test-results/vitest.json"
pw = json.load(io.open(pw_path, encoding="utf8"))

SIZES = ["320x568", "360x640", "375x667", "390x844", "414x896", "430x932", "667x375", "844x390", "768x1024", "820x1180", "1024x768", "1280x720", "1366x768", "1440x900", "1536x864", "1920x1080", "2560x1440"]
ENGINES = ["chromium", "firefox", "webkit"]

rows = []  # (spec_title, project, status, first_error)


def walk(suite):
    for sp in suite.get("specs", []):
        for t in sp["tests"]:
            results = t["results"]
            final = results[-1]["status"] if results else "skipped"
            flaky = final == "passed" and any(r["status"] != "passed" for r in results[:-1])
            err = ""
            for r in results:
                if r.get("errors"):
                    err = re.sub(r"\x1b\[[0-9;]*m", "", r["errors"][0].get("message", "")).split("\n")[0][:200]
                    break
            rows.append((sp["title"], t["projectName"], "flaky" if flaky else final, err))
    for s in suite.get("suites", []):
        walk(s)


for s in pw["suites"]:
    walk(s)

stats = pw.get("stats", {})
ok = lambda st: st in ("passed", "flaky")

layout = [r for r in rows if r[0].startswith("layout ")]
a11y = [r for r in rows if r[0].startswith("a11y ")]
other = collections.defaultdict(list)
for r in rows:
    tag = re.search(r"@(\w+)", r[0])
    if tag and tag.group(1) not in ("layout", "a11y"):
        other[tag.group(1)].append(r)

routes = sorted({r[0][len("layout "):].replace(" @layout", "") for r in layout}, key=lambda x: x)


def cell(results):
    if not results:
        return "–"
    passed = sum(1 for r in results if ok(r[2]))
    mark = "✅" if passed == len(results) else "❌"
    return f"{mark} {passed}/{len(results)}"


out = io.StringIO()
w = lambda line="": out.write(line + "\n")

w("# QA report")
w()
w(f"Generated {datetime.datetime.now().strftime('%d %b %Y, %H:%M')} from `{pw_path}`.")
w()
total = len(rows)
passed = sum(1 for r in rows if r[2] == "passed")
flaky = sum(1 for r in rows if r[2] == "flaky")
failed = sum(1 for r in rows if r[2] in ("failed", "timedOut", "interrupted"))
w(f"**Playwright:** {total} tests: {passed} passed, {flaky} flaky (passed on retry), {failed} failed, across {len({r[1] for r in rows})} projects in {stats.get('duration', 0) / 60000:.1f} minutes.")
try:
    vt = json.load(io.open(vt_path, encoding="utf8"))
    w(f"**Vitest:** {vt['numTotalTests']} tests in {vt['numTotalTestSuites']} suites: {vt['numPassedTests']} passed, {vt['numFailedTests']} failed.")
except Exception:
    w("**Vitest:** results file not found; run `npx vitest run --reporter=json --outputFile=test-results/vitest.json`.")
w()

w("## Screen matrix")
w()
w("Every route is checked at 17 sizes in Chromium, Firefox and WebKit, plus browser zoom at 200% and large system text (150% root size). Each check runs the layout rules in `tests/e2e/helpers.ts`: no horizontal scroll, no text spilling or cut off without an ellipsis, images keep their aspect ratio, 44px touch targets with 8px spacing on touch screens, nothing hidden under a fixed bar, and no console errors or warnings.")
w()
w("Sizes: " + ", ".join(SIZES) + ".")
w()
w("| Route | Chromium | Firefox | WebKit | Zoom 200% | Large text | axe |")
w("| --- | --- | --- | --- | --- | --- | --- |")
for route in routes:
    title = f"layout {route} @layout"
    by = lambda pred: [r for r in layout if r[0] == title and pred(r[1])]
    ax = [r for r in a11y if r[0] == f"a11y {route} @a11y"]
    w(f"| `{route}` | {cell(by(lambda p: p.startswith('chromium-') and p[9:] in SIZES))} | {cell(by(lambda p: p.startswith('firefox-')))} | {cell(by(lambda p: p.startswith('webkit-')))} | {cell(by(lambda p: p == 'chromium-zoom200'))} | {cell(by(lambda p: p == 'chromium-largetext'))} | {cell(ax)} |")
w()

w("### By size")
w()
w("| Size | Chromium | Firefox | WebKit |")
w("| --- | --- | --- | --- |")
for size in SIZES:
    w(f"| {size} | " + " | ".join(cell([r for r in layout if r[1] == f'{e}-{size}']) for e in ENGINES) + " |")
w()

w("## Other suites")
w()
w("| Suite | What it covers | Result |")
w("| --- | --- | --- |")
WHAT = {
    "flow": "Gate walkthroughs: admin search and audited reveal, buyer deal flow to payment, deal-path wizard, page editor to publish and restore, zero-total checkout",
    "stress": "Stress data on every list and card: long and unbroken text, Indic scripts, 500 items, 5,000 reviews, missing images, huge and tiny prices, 100% coupon; slow network, failed request, empty search",
    "visual": "Screenshots at phone, tablet and desktop: /design (every component) and 11 key screens",
}
for tag, rs in sorted(other.items()):
    w(f"| @{tag} | {WHAT.get(tag, '')} | {cell(rs)} |")
w()

bad = [r for r in rows if not ok(r[2])]
w("## Failures")
w()
if not bad:
    w("None.")
else:
    for r in bad[:80]:
        w(f"- `{r[1]}` {r[0]}: {r[3]}")
w()
flk = [r for r in rows if r[2] == "flaky"]
w("## Flaky (passed on retry)")
w()
if not flk:
    w("None.")
else:
    for r in flk:
        w(f"- `{r[1]}` {r[0]}: {r[3]}")
w()

try:
    w(io.open("tests/qa-phases.md", encoding="utf8").read().rstrip())
    w()
except FileNotFoundError:
    pass

w("## Known issues")
w()
w("- **Uploads stay in this browser.** Media for visual pages is stored in IndexedDB until the backend exists, so a page with uploads shows placeholders on another device.")
w("- **Visual baselines are Windows-only.** Other platforms need their own: run the visual tests with --update-snapshots on that platform, then check every new screenshot by eye.")
w("- **Fixed bars in full-page screenshots** appear mid-page; that's how Playwright stitches full-page captures, not a layout bug.")
w()

w("## Screenshots")
w()
w("- Visual baselines: `tests/e2e/__screenshots__/<project>/<screen>-<platform>.png` (recorded on Windows; CI compares on Windows).")
w("- Failure screenshots, traces and diffs: `test-results/` after a run, and the HTML report in `playwright-report/` (`npx playwright show-report`).")
w()

w("## How to run every check")
w()
w("```bash")
w("npm run typecheck      # TypeScript")
w("npm run lint           # ESLint")
w("npm test               # Vitest: lib and component tests")
w("npm run test:ui        # component tests only")
w("npm run build          # production build (Playwright runs against it on port 3100)")
w("npm run test:e2e       # layout on every route x size x engine, flows, stress")
w("npm run test:a11y      # axe, zero serious or critical issues")
w("npm run test:visual    # screenshot comparisons")
w("npm run test:all       # all of the above")
w("```")
w()
w("One engine or size: `npx playwright test --project=webkit-390x844`. One spec: `npx playwright test tests/e2e/flows.spec.ts`. Report: `python tests/qa-report.py test-results/full.json test-results/vitest.json`.")
w()

io.open("QA_REPORT.md", "w", encoding="utf8", newline="\n").write(out.getvalue())
print(f"QA_REPORT.md: {total} playwright tests, {failed} failed, {flaky} flaky")
