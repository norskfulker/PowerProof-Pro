"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { HeaderSettings } from "@/lib/types";
import { Field } from "./design-panels";
import { TargetSelect } from "./target-select";

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

/** The store header: logo position, sticky, search and its own menu links */
export function HeaderEditor({ header, onChange }: { header: HeaderSettings; onChange: (h: HeaderSettings) => void }) {
  const set = (p: Partial<HeaderSettings>) => onChange({ ...header, ...p });
  const custom = header.links;
  return (
    <div className="flex flex-col gap-4">
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
