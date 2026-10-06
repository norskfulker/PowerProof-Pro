"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SettingsTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

function Inner({ tabs, label }: { tabs: SettingsTab[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const want = search.get("tab");
  const value = tabs.some((t) => t.id === want) ? want! : tabs[0].id;
  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        const q = new URLSearchParams(search.toString());
        if (v === tabs[0].id) q.delete("tab");
        else q.set("tab", v);
        const qs = q.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      className="flex flex-col gap-6"
    >
      <TabsList aria-label={label} className="max-w-full justify-start overflow-x-auto sm:w-fit">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="shrink-0 pointer-coarse:min-h-11">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        // Kept mounted so unsaved changes in another tab still count (the save bar and leave warning)
        <TabsContent key={t.id} value={t.id} forceMount className="flex flex-col gap-6 data-[state=inactive]:hidden">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Tabs inside a settings section (Part 7C), so long pages stay short. The tab is in ?tab= for links. */
export function SettingsTabs({ tabs, label }: { tabs: SettingsTab[]; label: string }) {
  return (
    <Suspense fallback={<div className="flex flex-col gap-6">{tabs[0].content}</div>}>
      <Inner tabs={tabs} label={label} />
    </Suspense>
  );
}
