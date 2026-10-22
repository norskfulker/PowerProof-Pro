import Link from "next/link";
import { localPrice } from "@/lib/money";
import type { CurrencyCode, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";
import { StatusPill } from "./status-pill";

const KIND_LABEL: Record<Product["kind"], string> = {
  ebook: "Ebook",
  template: "Template",
  preset: "Presets",
  notion: "Notion kit",
  course: "Course",
  audio: "Audio",
  other: "Digital",
};

export function kindLabel(kind: Product["kind"]) {
  return KIND_LABEL[kind];
}

/** Used on the creator grid (with status and sales) and the buyer store (with local price). */
export function ProductCard({
  product,
  href,
  currency,
  variant = "creator",
  className,
}: {
  product: Product;
  href: string;
  /** Buyer currency for local price. */
  currency?: CurrencyCode;
  variant?: "creator" | "buyer";
  className?: string;
}) {
  const price = currency ? localPrice(product.price, currency) : product.price;
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border bg-surface transition-[border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
        className
      )}
    >
      <span className="relative block overflow-hidden bg-muted">
        <ProductImageView image={product.images[0]} fallback={product.tileBackground} fallbackLabel={product.title} className="rounded-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
        {variant === "creator" && <span className="absolute top-3 left-3"><StatusPill status={product.status} /></span>}
      </span>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="eyebrow">{KIND_LABEL[product.kind]}</span>
        <p className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]">{product.title}</p>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
          <span className="flex items-baseline gap-2">
            <MoneyText value={price} className="font-display text-lg font-bold tracking-[-0.02em]" />
            {product.compareAt && variant === "buyer" && (
              <MoneyText
                value={currency ? localPrice(product.compareAt, currency) : product.compareAt}
                className="text-sm text-muted-foreground line-through"
              />
            )}
          </span>
          {variant === "creator" && <span className="text-xs font-medium text-muted-foreground tabular">{product.salesCount} sold</span>}
        </div>
      </div>
    </Link>
  );
}
