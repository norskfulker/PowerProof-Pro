import { StoreShell } from "@/components/storefront/store-shell";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ store: string }> }) {
  const { store } = await params;
  return <StoreShell slug={store}>{children}</StoreShell>;
}
