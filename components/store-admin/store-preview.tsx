"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreDesign } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Live preview: the real store in an iframe. Draft designs are posted in, so what you see
 * is exactly what buyers get. Desktop renders at 1280px and is scaled to fit.
 */
export function StorePreview({ slug, design }: { slug: string; design: StoreDesign }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [width, setWidth] = useState(800);
  const [ready, setReady] = useState(false);
  // "Preview as": the store's own default unless the creator wants to check the other theme
  const [as, setAs] = useState<"default" | "light" | "dark">("default");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "pp-preview-ready") setReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const shown = as === "default" ? design : { ...design, theme: { ...design.theme, mode: as } };
    frame.current?.contentWindow?.postMessage({ type: "pp-design", design: shown }, window.location.origin);
  }, [design, ready, device, as]);

  const desktopW = 1280;
  const scale = device === "desktop" ? Math.min(1, width / desktopW) : 1;
  const frameW = device === "desktop" ? desktopW : 390;
  const frameH = device === "desktop" ? 820 / scale : 760;

  return (
    <section aria-label="Live preview" className="flex flex-col overflow-hidden rounded-card border bg-surface-sunken">
      <div className="flex items-center justify-between gap-2 border-b bg-surface px-3 py-2">
        <p className="eyebrow pl-1">Live preview{ready ? "" : " · loading"}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div role="group" aria-label="Preview as" className="flex gap-2">
            <Button size="icon-sm" variant={as === "light" ? "secondary" : "ghost"} aria-pressed={as === "light"} onClick={() => setAs(as === "light" ? "default" : "light")} aria-label="Preview as light"><Sun /></Button>
            <Button size="icon-sm" variant={as === "dark" ? "secondary" : "ghost"} aria-pressed={as === "dark"} onClick={() => setAs(as === "dark" ? "default" : "dark")} aria-label="Preview as dark"><Moon /></Button>
          </div>
          <div role="group" aria-label="Preview size" className="flex gap-2">
            <Button size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} onClick={() => { setReady(false); setDevice("desktop"); }} aria-label="Desktop preview"><Monitor /></Button>
            <Button size="icon-sm" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} onClick={() => { setReady(false); setDevice("mobile"); }} aria-label="Phone preview"><Smartphone /></Button>
          </div>
          <Button asChild size="sm" variant="ghost"><Link href={`/s/${slug}`} target="_blank">Open <ExternalLink aria-hidden /></Link></Button>
        </div>
      </div>
      <div ref={box} className="flex justify-center overflow-hidden p-0 md:p-3" style={{ height: device === "desktop" ? 820 : 790 }}>
        <div style={{ width: frameW * scale, height: frameH * scale }} className={cn("shrink-0 overflow-hidden bg-surface", device === "mobile" && "rounded-[28px] border-4 border-foreground/80")}>
          <iframe
            ref={frame}
            key={device}
            title="Store preview"
            src={`/s/${slug}`}
            style={{ width: frameW, height: frameH, transform: `scale(${scale})`, transformOrigin: "top left" }}
            className="border-0 bg-surface"
          />
        </div>
      </div>
    </section>
  );
}
