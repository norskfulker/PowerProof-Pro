import type { Metadata } from "next";
import { PageHeader } from "@/components/pp/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav />
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </>
  );
}
