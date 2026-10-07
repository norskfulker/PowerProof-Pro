import { expect, type Page, type TestInfo } from "@playwright/test";

export interface PrepareOptions {
  largeText?: boolean;
  /** Freeze the clock for visual snapshots */
  frozen?: boolean;
}

/** Fixed instant for deterministic snapshots: Monday 5 Oct 2026, 11:00 IST */
export const FROZEN_TIME = new Date("2026-10-05T05:30:00.000Z");

/** Makes every database request fail, to see the error states with their retry buttons. */
export async function failDatabase(page: Page) {
  await page.route(/\/rest\/v1\//, (route) => route.abort("failed"));
}

/** Delays every database request, to see the loading skeletons. */
export async function slowDatabase(page: Page, ms = 1500) {
  await page.route(/\/rest\/v1\//, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

export async function prepare(page: Page, testInfo: TestInfo, opts: PrepareOptions = {}) {
  const largeText = opts.largeText ?? !!testInfo.project.metadata?.largeText;
  if (opts.frozen) await page.clock.setFixedTime(FROZEN_TIME);
  if (largeText) {
    await page.addInitScript(() => {
      const s = document.createElement("style");
      s.textContent = "html{font-size:150% !important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
    });
  }
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      const t = m.text();
      // Next dev/HMR noise never happens in production; ignore third-party font preload hints only.
      if (/preload|was preloaded/i.test(t)) return;
      // Playwright's init script is injected into sandboxed srcdoc frames (email previews) and blocked there
      if (/Blocked script execution in 'about:srcdoc'/.test(t)) return;
      // Firefox's own performance hint while an iframe preview is still loading its stylesheet
      if (/Layout was forced before the page was fully loaded/.test(t)) return;
      errors.push(`${m.type()}: ${t}`);
    }
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return { errors };
}

/** Waits until data has loaded: network idle, no skeletons, nothing aria-busy. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Typing before React hydrates is lost on slow engines: wait for the app to take over
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true", undefined, { timeout: 15000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[data-slot="skeleton"], [aria-busy="true"]'), undefined, { timeout: 8000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(150);
}

export interface LayoutIssue {
  rule: string;
  detail: string;
}

/** Runs every layout rule from QA Part 5 section D inside the page. */
export async function layoutIssues(page: Page): Promise<LayoutIssue[]> {
  return page.evaluate(() => {
    const issues: { rule: string; detail: string }[] = [];
    const describe = (el: Element) => {
      const label = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${label ? ` "${label}"` : ""}`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
      if (el.closest('[aria-hidden="true"], [inert], .sr-only')) return false;
      // Scrolled out of view inside a scroll container: not visible, not tappable
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflowY)) {
          const pr = p.getBoundingClientRect();
          if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1 || r.right <= pr.left + 1 || r.left >= pr.right - 1) return false;
        }
      }
      // clipped to nothing by an ancestor (sr-only style)
      if (r.width <= 1 && r.height <= 1) return false;
      return true;
    };

    // 1. No horizontal scrolling
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) {
      const wide = [...document.querySelectorAll("body *")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.right > de.clientWidth + 1 && getComputedStyle(e).position !== "fixed" && !e.closest(".overflow-x-auto, .overflow-auto, .overflow-hidden, [data-slot=table-container]");
      });
      issues.push({ rule: "horizontal-scroll", detail: `scrollWidth ${de.scrollWidth} > ${de.clientWidth}; e.g. ${wide.slice(0, 3).map(describe).join(", ")}` });
    }

    // 2. Text spilling out of its box
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (!visible(el) || el.children.length > 0 || !el.textContent?.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || el.closest("[data-allow-overflow], .overflow-x-auto, .overflow-auto, pre, code, svg, textarea, input, select")) continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        const clipped = cs.overflowX === "hidden" || cs.overflowX === "clip";
        const ellipsis = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none";
        if (!clipped) issues.push({ rule: "text-overflow", detail: `${describe(el)} spills ${el.scrollWidth - el.clientWidth}px` });
        else if (!ellipsis) issues.push({ rule: "text-clipped", detail: `${describe(el)} cut off without ellipsis` });
      }
    }

    // 3. Images keep aspect ratio
    for (const img of document.querySelectorAll("img")) {
      if (!visible(img) || !img.naturalWidth) continue;
      const fit = getComputedStyle(img).objectFit;
      if (fit === "cover" || fit === "contain" || fit === "scale-down") continue;
      const r = img.getBoundingClientRect();
      const ratio = r.width / r.height / (img.naturalWidth / img.naturalHeight);
      if (Math.abs(1 - ratio) > 0.03) issues.push({ rule: "image-stretched", detail: describe(img) });
    }

    // 4. Tap targets on touch screens
    const touch = matchMedia("(pointer: coarse)").matches;
    const targets = [...document.querySelectorAll<HTMLElement>('a[href], button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], input:not([type=hidden]), select, textarea, summary')]
      .filter((el) => visible(el) && !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1");
    // The tappable area, clipped to any scroll container it sits in
    const hit = (el: HTMLElement) => {
      const area = el.closest("label, [data-hit-area]") ?? el;
      const r = area.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let p = area.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflowY)) {
          const pr = p.getBoundingClientRect();
          left = Math.max(left, pr.left);
          top = Math.max(top, pr.top);
          right = Math.min(right, pr.right);
          bottom = Math.min(bottom, pr.bottom);
        }
      }
      return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
    };
    const isInlineText = (el: HTMLElement) => {
      if (el.tagName !== "A") return false;
      const p = el.parentElement;
      if (!p) return false;
      const text = [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim().length > 0);
      // WCAG 2.5.8 exempts links inside a sentence
      return text && getComputedStyle(el).display === "inline";
    };
    if (touch) {
      const rects: DOMRect[] = [];
      const els: HTMLElement[] = [];
      for (const el of targets) {
        if (isInlineText(el)) continue;
        const full = (el.closest("label, [data-hit-area]") ?? el).getBoundingClientRect();
        if (full.height < 43.5 || full.width < 43.5) issues.push({ rule: "tap-target", detail: `${describe(el)} is ${Math.round(full.width)}x${Math.round(full.height)}` });
        const r = hit(el);
        if (r.width < 1 || r.height < 1) continue;
        rects.push(r);
        els.push(el);
      }
      // Spacing: neighbours closer than 8px but not touching/overlapping containers.
      // A page control passing under a fixed bar is not a neighbour: it scrolls away.
      const inFixed = (el: HTMLElement) => {
        for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
        return false;
      };
      const fixed = els.map(inFixed);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (fixed[i] !== fixed[j]) continue;
          const a = rects[i], b = rects[j];
          const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
          const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
          const gap = Math.max(dx, dy);
          const overlap = dx === 0 && dy === 0;
          if (!overlap && gap > 2 && gap < 7.5 && (dx === 0 || dy === 0)) {
            issues.push({ rule: "tap-spacing", detail: `${Math.round(gap)}px between ${describe(els[i])} and ${describe(els[j])}` });
          }
        }
      }
    }

    // 5. Nothing hidden behind a fixed bottom bar once scrolled to the end
    window.scrollTo(0, document.scrollingElement!.scrollHeight);
    const bars = [...document.querySelectorAll<HTMLElement>("body *")].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || !visible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.bottom >= innerHeight - 2 && r.height < innerHeight / 2 && r.width > innerWidth / 2;
    });
    for (const bar of bars) {
      const br = bar.getBoundingClientRect();
      for (const el of targets) {
        if (bars.some((b) => b.contains(el)) || getComputedStyle(el).position === "fixed" || getComputedStyle(el).position === "sticky") continue;
        if (el.closest('[style*="position: fixed"], .fixed, .sticky')) continue;
        const r = el.getBoundingClientRect();
        const overlapsX = r.right > br.left + 2 && r.left < br.right - 2;
        if (overlapsX && r.bottom > br.top + 2 && r.top < innerHeight) issues.push({ rule: "under-sticky-bar", detail: `${describe(el)} sits under a fixed bar` });
      }
    }
    window.scrollTo(0, 0);
    return issues;
  });
}

export function report(issues: LayoutIssue[], max = 25) {
  return issues.slice(0, max).map((i) => `[${i.rule}] ${i.detail}`).join("\n");
}

export async function expectNoConsoleErrors(errors: string[]) {
  expect(errors, errors.join("\n")).toEqual([]);
}
