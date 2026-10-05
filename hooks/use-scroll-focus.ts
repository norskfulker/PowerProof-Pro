"use client";

import { useEffect, useRef } from "react";

/**
 * Makes a scroll container keyboard-reachable only while it actually scrolls,
 * so wide tables and code blocks can be scrolled with arrow keys without
 * adding a dead tab stop when everything fits.
 */
export function useScrollFocus<T extends HTMLElement>(label?: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (scrolls) {
        el.tabIndex = 0;
        el.setAttribute("role", "region");
        if (label && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", label);
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [label]);
  return ref;
}
