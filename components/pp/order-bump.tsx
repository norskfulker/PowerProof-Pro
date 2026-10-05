"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Money, ProductImage } from "@/lib/types";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";

/** One optional add-on at checkout. */
export function OrderBump({
  label,
  description,
  image,
  price,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  image?: ProductImage;
  price: Money;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-card border-2 border-dashed border-accent bg-accent-soft p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" aria-describedby="bump-desc" />
      {image && <ProductImageView image={image} size="xs" className="w-16 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {label} for <MoneyText value={price} />
        </span>
        <span id="bump-desc" className="block text-sm text-foreground/80">{description}</span>
      </span>
    </label>
  );
}
