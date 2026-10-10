import type { Metadata } from "next";
import { AppShell } from "@/components/pp/app-shell";
import { requireStore } from "@/lib/supabase/creator-gate";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · PowerProof" } };

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  await requireStore();
  return <AppShell>{children}</AppShell>;
}
