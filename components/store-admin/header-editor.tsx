"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { MediaUploader } from "@/components/media/media-uploader";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { HeaderSettings, Store } from "@/lib/types";
import { Field } from "./design-panels";
import { TargetSelect } from "./target-select";

/** Which frame crops the logo: wide pictures get 16:9, everything else the square tile */
function detectLogoShape(src: string): Promise<"1:1" | "16:9"> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight) >= 1.25 ? "16:9" : "1:1");
    img.onerror = () => resolve("1:1");
    img.src = src;
  });
}

/** A list of rows that can be added, removed and moved up or down */
function Rows<T extends object>({ items, onChange, render, make, max, min = 0, noun }: { items: T[]; onChange: (items: T[]) => void; render: (item: T, set: (p: Partial<T>) => void, i: number) => React.ReactNode; make: () => T; max: number; min?: number; noun: string }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3" aria-label={`${noun}s`}>
        {items.map((item, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-control border bg-surface-sunken p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-muted-foreground">{noun} {i + 1}</span>
              <span className="flex">
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${noun.toLowerCase()} ${i + 1} up`}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${noun.toLowerCase()} ${i + 1} down`}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={items.length <= min} onClick={() => onChange(items.filter((_, x) => x !== i))} aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}><Trash2 /></Button>
              </span>
            </div>
            {render(item, (p) => onChange(items.map((x, xi) => (xi === i ? { ...x, ...p } : x))), i)}
          </li>
        ))}
      </ol>
      <Button type="button" variant="secondary" className="self-start" disabled={items.length >= max} onClick={() => onChange([...items, make()])}><Plus aria-hidden /> Add {noun.toLowerCase()}</Button>
    </div>
  );
}

/** The store header: logo, logo position, sticky, search and its own menu links */
export function HeaderEditor({ header, onChange, logo, onLogo }: { header: HeaderSettings; onChange: (h: HeaderSettings) => void; /** The store logo, uploaded to the media library and saved with the draft */ logo: Store["logo"]; onLogo: (logo: Store["logo"]) => void }) {
  const set = useCallback((p: Partial<HeaderSettings>) => onChange({ ...header, ...p }), [header, onChange]);
  const custom = header.links;
  // The frame follows the picture: wide images get the 16:9 crop, everything else the square one.
  const detectedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (logo?.src && !header.logoShape && detectedFor.current !== logo.src) {
      detectedFor.current = logo.src;
      let alive = true;
      detectLogoShape(logo.src).then((logoShape) => alive && set({ logoShape }));
      return () => {
        alive = false;
      };
    }
  }, [logo?.src, header.logoShape, set]);
  const setLogo = (m: { src: string; alt: string } | undefined) => {
    onLogo(m);
    if (m) void detectLogoShape(m.src).then((logoShape) => set({ logoShape }));
  };
  return (
    <div className="flex flex-col gap-4">
      <MediaUploader compact label="Logo (optional)" kinds={["image"]} aspect="1:1" withFocal={false} hint="Any shape works — it's cropped to fit automatically. It lands in your media library. Without one, your store's first letters are used." value={logo ? { ...logo, kind: "image" } : undefined} onChange={(m) => setLogo(m ? { src: m.src, alt: m.alt } : undefined)} />
      {logo?.src && (
        <>
          <p className="-mt-2 text-xs text-muted-foreground">Showing {header.logoShape === "16:9" ? "wide (16:9)" : "square (1:1)"}, cropped from your image.</p>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
            Show the store name beside the logo
            <Switch checked={header.showName !== false} onCheckedChange={(showName) => set({ showName })} aria-label="Show the store name beside the logo" />
          </label>
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Logo and menu position</span>
        <Segmented label="Logo and menu position" value={header.align ?? "left"} onChange={(align) => set({ align })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">Stay at the top while scrolling<Switch checked={header.sticky !== false} onCheckedChange={(sticky) => set({ sticky })} aria-label="Stay at the top while scrolling" /></label>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">Show the search box<Switch checked={header.search !== false} onCheckedChange={(search) => set({ search })} aria-label="Show the search box" /></label>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
        Choose my own menu links
        <Switch checked={!!custom} onCheckedChange={(on) => set({ links: on ? [{ label: "All products", target: "products" }, { label: "Contact", target: "page:contact" }] : undefined })} aria-label="Choose my own menu links" />
      </label>
      {!custom && <p className="text-sm text-muted-foreground">Showing All products, your first four collections and Contact.</p>}
      {custom && (
        <Rows<{ label: string; target: string }>
          noun="Link"
          max={8}
          items={custom}
          onChange={(links) => set({ links })}
          make={() => ({ label: "", target: "products" })}
          render={(l, put, i) => (
            <>
              <Field id={`nl-${i}`} label="Label"><Input id={`nl-${i}`} value={l.label} maxLength={24} onChange={(e) => put({ label: e.target.value })} /></Field>
              <TargetSelect id={`nt-${i}`} label="Goes to" value={l.target} onChange={(target) => put({ target })} />
            </>
          )}
        />
      )}
    </div>
  );
}
