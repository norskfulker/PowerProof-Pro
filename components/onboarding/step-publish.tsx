"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, ExternalLink, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/pp/copy-field";
import { MoneyText } from "@/components/pp/money-text";
import { ProductImageView } from "@/components/pp/product-cover";
import { updateProduct, updateStore } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import type { Product, Store } from "@/lib/types";
import { StepFrame } from "./step-frame";

export function StepPublish({
  store,
  product,
  bankAdded,
  onBack,
  onPublished,
}: {
  store: Store;
  product?: Product;
  bankAdded: boolean;
  onBack: () => void;
  onPublished?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const link = `${SITE_URL}/${store.slug}`;

  if (done) {
    const shareText = encodeURIComponent(`My store is live: https://${link}`);
    return (
      <section className="rounded-dialog border bg-surface p-6 text-center sm:p-10" aria-live="polite">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-accent-ink">
          <PartyPopper className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-[32px]">You&apos;re open for business.</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">Share the link anywhere. The first sale tends to feel unreal; the tenth feels normal.</p>
        <div className="mx-auto mt-6 max-w-md text-left">
          <CopyField label="Your store link" value={`https://${link}`} display={link} />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" rel="noreferrer">X</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/s/${store.slug}`} target="_blank">
              View store <ExternalLink aria-hidden />
            </Link>
          </Button>
        </div>
        <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
          <Link href="/dashboard">
            Go to my dashboard <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <StepFrame
      formId="step-publish"
      title="Ready when you are"
      description="Here's what buyers will see. Publishing makes your store and product live."
      timeLeft="Last step"
      onBack={onBack}
      submitLabel="Publish my store"
      pending={pending}
    >
      <form
        id="step-publish"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            if (product) await updateProduct(product.id, { status: "published" });
            await updateStore({ onboarded: true });
            setDone(true);
            onPublished?.();
          } catch (err) {
            toast.error("Couldn't publish", { description: err instanceof Error ? err.message : undefined });
          } finally {
            setPending(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="rounded-card border p-4">
          <p className="eyebrow">Store</p>
          <p className="mt-1 font-semibold">{store.name}</p>
          <p className="font-mono text-[13px] text-muted-foreground">{link}</p>
        </div>
        {product ? (
          <div className="flex gap-4 rounded-card border p-4">
            <ProductImageView image={product.images[0]} size="sm" className="w-24 shrink-0" />
            <div className="min-w-0">
              <p className="eyebrow">First product</p>
              <p className="mt-1 truncate font-semibold">{product.title}</p>
              <MoneyText value={product.price} />
            </div>
          </div>
        ) : (
          <p className="rounded-card border p-4 text-sm text-muted-foreground">No product yet. You can add one from your dashboard.</p>
        )}
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <Check className="size-4 text-success" aria-hidden /> Instant delivery and receipts are on
          </li>
          <li className="flex items-center gap-2">
            {bankAdded ? <Check className="size-4 text-success" aria-hidden /> : <CircleAlert className="size-4 text-warning" aria-hidden />}
            {bankAdded ? "Bank account verified" : "No bank account yet. Sales still work; add one before you withdraw."}
          </li>
        </ul>
      </form>
    </StepFrame>
  );
}
