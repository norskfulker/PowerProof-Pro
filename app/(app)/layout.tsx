import type { Metadata } from "next";
import { AppShell } from "@/components/pp/app-shell";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · PowerProof" } };

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
