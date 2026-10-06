import { StoreScopeGuard } from "@/components/store-admin/store-scope-guard";

/** The page editor works on the store in the URL (Part 7C). */
export default async function EditorStoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StoreScopeGuard storeId={id} badge={false}>
      {children}
    </StoreScopeGuard>
  );
}
