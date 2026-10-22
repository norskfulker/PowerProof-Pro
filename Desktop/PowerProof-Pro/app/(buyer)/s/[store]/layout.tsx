import type { Metadata } from "next";
import { getStorefront } from "@/lib/api/live/storefront";
import { siteUrl } from "@/lib/site-url";
import { StoreShell } from "@/components/storefront/store-shell";

/** Each store gets its own title, description, canonical address and share card. */
export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  try {
    const { store: slug } = await params;
    const view = await getStorefront(slug);
    const s = view.store;
    const description = (s.tagline || `${s.name} — digital products with instant delivery.`).slice(0, 160);
    const url = `${siteUrl()}/s/${s.slug}`;
    const image = s.logo?.src.startsWith("https://") ? s.logo.src : undefined;
    return {
      title: s.name,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "website",
        siteName: s.name,
        title: s.name,
        description,
        url,
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: s.name,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ store: string }> }) {
  const { store } = await params;
  return <StoreShell slug={store}>{children}</StoreShell>;
}
