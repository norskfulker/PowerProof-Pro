"use client";

import Link from "next/link";
import { ArrowRight, FileSpreadsheet, FileUp, Package } from "lucide-react";
import { GuardedLink, LimitNotice } from "@/components/plan/plan-context";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewProductForm } from "@/components/products/new-product-form";
import { useApi } from "@/hooks/use-api";
import { getProducts } from "@/lib/api";

/** The first choice: what kind of product this is. The steps after it are the same for both. */
const WAYS = [
  {
    href: "/catalog/products/new/upload?type=digital",
    icon: FileUp,
    title: "Digital product",
    body: "Something buyers download: a PDF, template, preset, course or audio. Upload the file, name it, set a price.",
    meta: "About a minute",
    primary: true,
  },
  {
    href: "/catalog/products/new/upload?type=physical",
    icon: Package,
    title: "Physical product",
    body: "Something you ship. Same steps, without a file, and it lives in a collection so buyers can find it.",
    meta: "Needs a collection",
  },
];

export default function NewProductPage() {
  const products = useApi(() => getProducts(), []);
  // Someone's first product is three short steps; after that, the full form and a way to import many
  if (!products.data && !products.error) return <Skeleton className="h-96 rounded-card" />;
  if (products.data?.length === 0) return <NewProductForm type="digital" wizard />;
  return (
    <>
      <PageHeader back={{ href: "/catalog/products", label: "Products" }} title="Add a product" description="First, is it digital or physical? The steps are the same for both." />
      <LimitNotice kind="products" />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {WAYS.map((w) => (
          <li key={w.href} data-coach={w.primary ? "new-product" : undefined}>
            <GuardedLink
              kind="products"
              href={w.href}
              className="group flex h-full flex-col rounded-card border bg-surface p-6 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary"
            >
              <span className={w.primary ? "grid size-12 place-items-center rounded-control bg-primary text-primary-foreground" : "grid size-12 place-items-center rounded-control bg-primary-soft text-primary"}>
                <w.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl">{w.title}</h2>
              <p className="mt-2 flex-1 text-muted-foreground">{w.body}</p>
              <span className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="eyebrow">{w.meta}</span>
                <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </GuardedLink>
          </li>
        ))}
      </ul>
      <section aria-labelledby="bulk-h" className="mt-6 flex flex-wrap items-center gap-4 rounded-card border border-dashed bg-surface-sunken p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground"><FileSpreadsheet className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <h2 id="bulk-h" className="font-sans text-base font-semibold tracking-normal">Import many products at once</h2>
          <p className="text-sm text-muted-foreground">Fill in a spreadsheet (CSV) and bring a whole catalogue in. We give you the format to follow.</p>
        </span>
        <Button asChild variant="secondary">
          <Link href="/catalog/products/import">Import from CSV</Link>
        </Button>
      </section>
    </>
  );
}
