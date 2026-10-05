import { Check, Quote } from "lucide-react";
import { MoneyText } from "@/components/pp/money-text";
import { ProductImageView } from "@/components/pp/product-cover";
import type { Money, PageBlock, ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface RenderProduct {
  title: string;
  price: Money;
  image?: ProductImage;
}

/**
 * Renders a page's blocks the way buyers will see them. Pure markup so it works in the
 * editor canvas, template previews and the live buyer page.
 */
export function PageRenderer({
  blocks,
  product,
  storeName,
  selectedId,
  onSelect,
  onBuy,
  compact,
}: {
  blocks: PageBlock[];
  product?: RenderProduct;
  storeName?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onBuy?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("bg-surface text-foreground", compact ? "text-[0.8125rem]" : "")}>
      {blocks.map((b) => {
        const editable = !!onSelect;
        const Wrapper = editable ? "button" : "div";
        return (
          <Wrapper
            key={b.id}
            type={editable ? "button" : undefined}
            onClick={editable ? () => onSelect?.(b.id) : undefined}
            className={cn(
              "block w-full text-left",
              editable && "outline-offset-[-2px] hover:outline-1 hover:outline-dashed hover:outline-border-strong",
              selectedId === b.id && "outline-2 outline-solid outline-primary hover:outline-2 hover:outline-solid hover:outline-primary"
            )}
            aria-label={editable ? `Edit ${b.type} block` : undefined}
          >
            <Block block={b} product={product} storeName={storeName} onBuy={editable ? undefined : onBuy} compact={compact} />
          </Wrapper>
        );
      })}
    </div>
  );
}

function Block({
  block,
  product,
  storeName,
  onBuy,
  compact,
}: {
  block: PageBlock;
  product?: RenderProduct;
  storeName?: string;
  onBuy?: () => void;
  compact?: boolean;
}) {
  const pad = compact ? "px-5 py-6" : "px-6 py-12 md:px-12";
  switch (block.type) {
    case "hero":
      return (
        <section className={cn(pad, "grid items-center gap-6", product?.image && !compact && "md:grid-cols-2")}>
          <div>
            {storeName && <p className="eyebrow mb-3">{storeName}</p>}
            <h2 className={cn(compact ? "text-2xl" : "text-4xl md:text-5xl")}>{block.heading}</h2>
            <p className={cn("mt-3 text-muted-foreground", !compact && "text-lg")}>{block.body}</p>
          </div>
          {product?.image && <ProductImageView image={product.image} size={compact ? "sm" : "md"} />}
        </section>
      );
    case "features":
      return (
        <section className={cn(pad, "border-t")}>
          <h3 className={cn(compact ? "text-lg" : "text-2xl")}>{block.heading}</h3>
          <ul className={cn("mt-4 grid gap-2", !compact && "sm:grid-cols-2")}>
            {block.body.split("\n").filter(Boolean).map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </section>
      );
    case "testimonial":
      return (
        <section className={cn(pad, "border-t bg-primary-soft")}>
          <Quote className="size-6 text-primary" aria-hidden />
          <p className={cn("mt-3 font-display", compact ? "text-lg" : "text-2xl")}>{block.heading}</p>
          <p className="mt-2 text-sm text-muted-foreground">{block.body}</p>
        </section>
      );
    case "faq":
      return (
        <section className={cn(pad, "border-t")}>
          <h3 className={cn(compact ? "text-lg" : "text-2xl")}>{block.heading}</h3>
          <dl className="mt-4 flex flex-col gap-4">
            {block.body.split("\n").filter(Boolean).map((line) => {
              const [q, a] = line.split("|");
              return (
                <div key={q}>
                  <dt className="font-semibold">{q}</dt>
                  <dd className="text-muted-foreground">{a}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      );
    case "buy":
      return (
        <section className={cn(pad, "border-t text-center")}>
          <h3 className={cn(compact ? "text-lg" : "text-2xl")}>{block.heading}</h3>
          {product && (
            <p className="mt-2">
              <span className="font-medium">{product.title}</span> ·{" "}
              <MoneyText value={product.price} className="font-semibold" />
            </p>
          )}
          {onBuy ? (
            <button
              type="button"
              onClick={onBuy}
              className={cn(
                "mt-4 inline-flex items-center justify-center rounded-control bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover",
                compact ? "h-10 text-sm" : "h-12"
              )}
            >
              Buy now
            </button>
          ) : (
            <span
              className={cn(
                "mt-4 inline-flex items-center justify-center rounded-control bg-primary px-6 font-semibold text-primary-foreground",
                compact ? "h-10 text-sm" : "h-12"
              )}
            >
              Buy now
            </span>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{block.body}</p>
        </section>
      );
    case "text":
    default:
      return (
        <section className={cn(pad, "border-t first:border-t-0")}>
          <h3 className={cn(compact ? "text-lg" : "text-2xl")}>{block.heading}</h3>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{block.body}</p>
        </section>
      );
  }
}
