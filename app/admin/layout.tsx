import type { Metadata } from "next";
import { AppShell } from "@/components/pp/app-shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · PowerProof" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="admin">{children}</AppShell>;
}
