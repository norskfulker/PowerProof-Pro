"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SECTION_META } from "@/lib/store-themes";
import type { SectionSetting } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Turn store sections on or off and reorder them with arrows (no drag and drop yet). */
export function SectionToggleList({ sections, onChange, highlight }: { sections: SectionSetting[]; onChange: (s: SectionSetting[]) => void; /** The section just clicked in the preview */ highlight?: SectionSetting["id"] }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...sections];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <ol className="flex flex-col gap-2" aria-label="Store sections, in order">
      <li className="flex items-center gap-3 rounded-control border border-dashed bg-surface-sunken px-3 py-2 text-sm text-muted-foreground">Navbar · always on</li>
      {sections.map((s, i) => {
        const meta = SECTION_META[s.id];
        return (
          <li key={s.id} aria-current={highlight === s.id ? "true" : undefined} className={cn("flex items-center gap-2 rounded-control border bg-surface py-1.5 pr-1.5 pl-3", !s.enabled && "bg-surface-sunken", highlight === s.id && "border-primary outline-2 outline-primary")}>
            <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-semibold", !s.enabled && "text-muted-foreground")}>{meta.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{meta.description}</span>
            </span>
            <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
              <Switch checked={s.enabled} onCheckedChange={(v) => onChange(sections.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)))} aria-label={`Show ${meta.name}`} />
            </label>
            <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${meta.name} up`}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${meta.name} down`}><ArrowDown /></Button>
          </li>
        );
      })}
      <li className="flex items-center gap-3 rounded-control border border-dashed bg-surface-sunken px-3 py-2 text-sm text-muted-foreground">Footer · always on</li>
    </ol>
  );
}

/** "On" or "Off" next to a section's name, so its state is visible without opening it */
export function SectionState({ on }: { on?: boolean }) {
  return <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", on ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>{on ? "On" : "Off"}</span>;
}

/**
 * The on/off switch for one section, shown at the top of that section's own settings. It is the
 * same setting as the switch in the section list, so the two always agree.
 */
export function SectionSwitch({ id, sections, onChange, needs }: { id: SectionSetting["id"]; sections: SectionSetting[]; onChange: (s: SectionSetting[]) => void; needs?: string }) {
  const meta = SECTION_META[id];
  const on = sections.find((s) => s.id === id)?.enabled ?? false;
  return (
    <div className="mb-4 flex flex-col gap-1 rounded-control border bg-surface-sunken px-3 py-1">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
        Show {meta.name.toLowerCase()} on your store
        <Switch checked={on} onCheckedChange={(v) => onChange(sections.map((x) => (x.id === id ? { ...x, enabled: v } : x)))} aria-label={`${meta.name} on your store`} />
      </label>
      {on && needs && <p className="pb-2 text-xs text-muted-foreground">It stays out of the page until there is something to show. {needs}</p>}
    </div>
  );
}
