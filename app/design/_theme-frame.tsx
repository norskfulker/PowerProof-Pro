"use client";

import { useState } from "react";
import { Segmented } from "@/components/pp/segmented";
import { useTheme } from "@/components/theme/theme-toggle";
import { Switch } from "@/components/ui/switch";
import type { ThemePref } from "@/lib/theme";

/**
 * The kit in either theme (Part 7A). The switch changes the whole site's theme; Side by side
 * renders every component twice, in a light and a dark island, to compare them directly.
 */
export function ThemeFrame({ children }: { children: React.ReactNode }) {
  const { pref, setPref } = useTheme();
  const [both, setBoth] = useState(false);
  return (
    <>
      <div className="sticky top-16 z-20 -mx-[16px] mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 px-[16px] py-3 backdrop-blur md:mx-0 md:rounded-card md:border">
        <span className="eyebrow">Theme</span>
        <Segmented<ThemePref>
          label="Theme"
          value={pref}
          onChange={setPref}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch checked={both} onCheckedChange={setBoth} aria-label="Show light and dark side by side" />
          Side by side
        </label>
      </div>
      {both ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div data-theme="light" className="min-w-0 rounded-card border bg-background p-4 text-foreground md:p-6">
            <p className="eyebrow mb-4">Light</p>
            {children}
          </div>
          <div data-theme="dark" className="min-w-0 rounded-card border bg-background p-4 text-foreground md:p-6">
            <p className="eyebrow mb-4">Dark</p>
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
