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
        "group flex flex-col gap-3 rounded-card border bg-surface p-3 transition-[border-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-border-strong",
        className
      )}
    >
      <ProductImageView image={product.images[0]} fallback={product.tileBackground} fallbackLabel={product.title} />
      <div className="flex flex-1 flex-col gap-1 px-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{KIND_LABEL[product.kind]}</span>
          {variant === "creator" && <StatusPill status={product.status} />}
        </div>
        <p className="line-clamp-2 font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">{product.title}</p>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <span className="flex items-baseline gap-2">
            <MoneyText value={price} className="font-semibold" />
            {product.compareAt && variant === "buyer" && (
              <MoneyText
                value={currency ? localPrice(product.compareAt, currency) : product.compareAt}
                className="text-sm text-muted-foreground line-through"
              />
            )}
          </span>
          {variant === "creator" && (
            <span className="font-mono text-xs text-muted-foreground">{product.salesCount} sold</span>
          )}
        </div>
      </div>
    </Link>
  );
}
