"use client";

import { useEffect } from "react";

/**
 * One light for every glass icon on the page: it follows the pointer, so the highlights move in
 * real time as you look around. A single listener on the window, one write per frame, and nothing
 * at all when the person prefers reduced motion or has no fine pointer.
 */
export function GlassLight() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    let frame = 0;
    let x = 0.2;
    let y = 0.1;
    const onMove = (e: PointerEvent) => {
      x = e.clientX / window.innerWidth;
      y = e.clientY / window.innerHeight;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--light-x", x.toFixed(3));
        root.style.setProperty("--light-y", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
