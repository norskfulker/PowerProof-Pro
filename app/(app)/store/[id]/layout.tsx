import type { Metadata } from "next";
import { StoreScopeGuard } from "@/components/store-admin/store-scope-guard";

export const metadata: Metadata = { title: "Store" };

/**
 * Every store screen lives under /store/[id] (Part 7C) and says which store it belongs to (Part 6C).
 * The guard makes that store the active one, and turns /store/current/... into the real id.
 */
export default async function StoreAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoreScopeGuard storeId={id}>{children}</StoreScopeGuard>;
}
