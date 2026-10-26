import type { Metadata } from "next";
import { SettingsFrame } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsFrame>
      <div className="flex flex-col gap-6">{children}</div>
    </SettingsFrame>
  );
}
