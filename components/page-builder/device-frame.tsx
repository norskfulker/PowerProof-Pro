"use client";

import type { Device } from "@/lib/pages/editor-store";
import { cn } from "@/lib/utils";

/** The screen width each device shows the page at */
export const SCREEN_WIDTH: Record<Device, number | undefined> = { desktop: undefined, tablet: 820, mobile: 390 };
/** How tall a screen is at least, and what a "full screen" section fills on it */
export const SCREEN_HEIGHT: Record<Device, number> = { desktop: 720, tablet: 1180, mobile: 844 };

/**
 * The page on a device: a plain framed window on desktop (just the address on top), an iPad and
 * an iPhone. The screen clips the page to the device's rounded corners. The device grows
 * with the page (nothing scrolls inside it); the editor scrolls as one page instead.
 */
export function DeviceFrame({ device, address, dark, children }: { device: Device; address: string; dark?: boolean; children: React.ReactNode }) {
  if (device === "desktop") {
    return (
      <div className="mx-auto w-full overflow-hidden rounded-[14px] border bg-background shadow-deep">
        <div className="flex h-8 items-center justify-center border-b bg-surface px-4" aria-hidden>
          <span className="truncate text-[0.6875rem] font-medium text-muted-foreground">{address.replace(/^https:\/\//, "")}</span>
        </div>
        {children}
      </div>
    );
  }

  const phone = device === "mobile";
  const width = SCREEN_WIDTH[device]!;
  // Bezel thickness and corner radii, in step so the screen's curve sits inside the body's
  const bezel = phone ? 12 : 16;
  const outer = phone ? 56 : 40;
  const inner = outer - bezel;
  return (
    <div className="relative mx-auto" style={{ width: `min(100%, ${width + bezel * 2}px)` }}>
      {/* Side buttons */}
      {phone ? (
        <>
          <span aria-hidden className="absolute top-[120px] -left-[3px] h-8 w-[3px] rounded-l bg-neutral-700" />
          <span aria-hidden className="absolute top-[170px] -left-[3px] h-14 w-[3px] rounded-l bg-neutral-700" />
          <span aria-hidden className="absolute top-[236px] -left-[3px] h-14 w-[3px] rounded-l bg-neutral-700" />
          <span aria-hidden className="absolute top-[190px] -right-[3px] h-20 w-[3px] rounded-r bg-neutral-700" />
        </>
      ) : (
        <span aria-hidden className="absolute -top-[3px] right-16 h-[3px] w-12 rounded-t bg-neutral-700" />
      )}
      <div className="relative bg-neutral-900 shadow-[0_30px_70px_-25px_rgb(0_0_0/0.55)] ring-1 ring-neutral-700" style={{ borderRadius: outer, padding: bezel }}>
        {!phone && <span aria-hidden className="absolute top-[5px] left-1/2 size-[6px] -translate-x-1/2 rounded-full bg-neutral-600" />}
        <div className={cn("relative isolate overflow-hidden", dark ? "bg-[#0C1F1B]" : "bg-white")} style={{ borderRadius: inner }}>
          {phone ? (
            // Status bar with the Dynamic Island
            <div className={cn("relative flex h-12 items-center justify-between px-7 text-[0.8125rem] font-semibold", dark ? "text-white" : "text-black")} aria-hidden>
              <span>9:41</span>
              <span className="absolute inset-x-0 top-2.5 mx-auto h-[30px] w-[110px] rounded-full bg-black" />
              <span className="flex items-center gap-1">
                <span className="flex items-end gap-px">{[4, 6, 8, 10].map((h) => <span key={h} className="w-[3px] rounded-sm bg-current" style={{ height: h }} />)}</span>
                <span className="ml-1 h-[11px] w-[22px] rounded-[3px] border border-current p-px"><span className="block h-full w-3/4 rounded-[1px] bg-current" /></span>
              </span>
            </div>
          ) : null}
          {children}
          {phone && (
            <div className="flex h-7 items-center justify-center" aria-hidden>
              <span className={cn("h-[5px] w-[134px] rounded-full", dark ? "bg-white/80" : "bg-black/80")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
