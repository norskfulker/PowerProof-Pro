import type { Metadata } from "next";
import { PageHeader } from "@/components/pp/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { StoreBadge } from "@/components/store-admin/store-badge";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Your account, store, tax and team." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <SettingsNav />
        <div className="min-w-0">
          <StoreBadge />
          {children}
        </div>
      </div>
    </>
  );
}
