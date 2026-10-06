import "@testing-library/jest-dom/vitest";

// Unit tests run against the in-browser mock, never the live project
process.env.NEXT_PUBLIC_BACKEND = "mock";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom gaps that Radix and our components rely on
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= RO;
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? function () {};
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: vi.fn(),
}));

// Mock API layer: no artificial latency in unit tests
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("pp:demo", JSON.stringify({ fail: false, latency: [0, 0] }));
});
