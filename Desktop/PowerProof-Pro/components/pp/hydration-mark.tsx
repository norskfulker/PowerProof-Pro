"use client";

import { useEffect } from "react";

/** Marks <html data-hydrated> once React has taken over the page. Tests wait for it before typing. */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
