import { TEMPLATE_BLOCKS } from "@/lib/templates";
import type { PageTemplate } from "@/lib/types";
import { PageRenderer } from "./page-renderer";

const SAMPLE = {
  title: "Your product",
  price: { amount: 49900, currency: "INR" as const },
  image: {
    id: "s",
    alt: "Sample cover",
    cover: { template: "split" as const, title: "Your product", subtitle: "Sample", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" },
  },
};

export function TemplatePreview({ template, compact = true }: { template: PageTemplate; compact?: boolean }) {
  const blocks = TEMPLATE_BLOCKS[template].map((b, i) => ({ ...b, id: `${template}-${i}` }));
  return <PageRenderer blocks={blocks} product={SAMPLE} storeName="Your store" compact={compact} />;
}
