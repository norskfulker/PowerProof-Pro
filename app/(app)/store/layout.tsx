import type { Metadata } from "next";
import { StoreBadge } from "@/components/store-admin/store-badge";

export const metadata: Metadata = { title: "Store" };

/** Every store screen says which store it belongs to (Part 6C). */
export default function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreBadge layout />
      {children}
    </>
  );
}
