"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { Device } from "@/lib/pages/editor-store";
import { cn } from "@/lib/utils";

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Phone", icon: Smartphone },
];

export const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };

/** Desktop, tablet or phone preview of the canvas. */
export function DevicePreviewSwitch({ value, onChange, className }: { value: Device; onChange: (d: Device) => void; className?: string }) {
  return (
    <div role="group" aria-label="Preview size" className={cn("inline-flex gap-1 rounded-control bg-muted p-1 pointer-coarse:gap-2", className)}>
      {DEVICES.map((d) => (
        <button
          key={d.id}
          type="button"
          aria-pressed={value === d.id}
          aria-label={`${d.label} preview`}
          onClick={() => onChange(d.id)}
          className={cn(
            "grid size-9 place-items-center rounded-[7px] border border-transparent text-muted-foreground pointer-coarse:size-11",
            value === d.id ? "border-border bg-surface text-foreground" : "hover:text-foreground"
          )}
        >
          <d.icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
