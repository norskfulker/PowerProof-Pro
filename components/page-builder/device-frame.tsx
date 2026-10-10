"use client";

import type { Device } from "@/lib/pages/editor-store";
import { cn } from "@/lib/utils";

/** The screen width each device shows the page at */
export const SCREEN_WIDTH: Record<Device, number | undefined> = { desktop: undefined, tablet: 820, mobile: 390 };
/** How tall a screen is at least, and what a "full screen" section fills on it */
export const SCREEN_HEIGHT: Record<Device, number> = { desktop: 720, tablet: 1180, mobile: 844 };

/**
 * The page on a device, drawn the way it would really look: a Mac browser window on desktop, an
 * iPad and an iPhone. The screen clips the page to the device's rounded corners. The device grows
 * with the page (nothing scrolls inside it); the editor scrolls as one page instead.
 */
export function DeviceFrame({ device, address, dark, children }: { device: Device; address: string; dark?: boolean; children: React.ReactNode }) {
  if (device === "desktop") {
    return (
      <div className="mx-auto w-full overflow-hidden rounded-[12px] border border-black/10 bg-background shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)] dark:border-white/10">
        <div className="relative flex h-10 items-center gap-2 border-b bg-[#ECECEC] px-4 dark:bg-[#2A2A2A]" aria-hidden>
          <span className="size-3 rounded-full bg-[#FF5F57]" />
          <span className="size-3 rounded-full bg-[#FEBC2E]" />
          <span className="size-3 rounded-full bg-[#28C840]" />
          <span className="absolute inset-x-0 mx-auto flex h-6 w-[min(28rem,60%)] items-center justify-center truncate rounded-md bg-white/80 px-3 font-mono text-[0.6875rem] text-black/60 dark:bg-black/30 dark:text-white/60">{address}</span>
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
