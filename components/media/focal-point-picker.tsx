"use client";

import type { Focal } from "@/lib/types";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Click (or use the arrow keys) to choose the part of a picture that must stay in frame when it's
 * cropped to different shapes. Shift+arrow moves in bigger steps.
 */
export function FocalPointPicker({ value, onChange, children, className }: { value: Focal; onChange: (f: Focal) => void; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Focal point"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value.x}
      aria-valuetext={`${value.x}% across, ${value.y}% down. Click the picture or use arrow keys to move it.`}
      className={cn("relative cursor-crosshair overflow-hidden rounded-media outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary", className)}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onChange({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) });
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 5;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        onChange({ x: clamp(value.x + d[0]), y: clamp(value.y + d[1]) });
      }}
    >
      {children}
      <span aria-hidden className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(0_0_0/0.5)]" style={{ left: `${value.x}%`, top: `${value.y}%` }}>
        <span className="absolute inset-[9px] rounded-full bg-white" />
      </span>
    </div>
  );
}
