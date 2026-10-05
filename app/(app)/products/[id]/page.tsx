"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { CopyField } from "@/components/pp/copy-field";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { ProductForm } from "@/components/products/product-form";
import { toInput, toValues } from "@/components/products/to-values";
import { useApi } from "@/hooks/use-api";
import { deleteProduct, getProduct, getStore, updateProduct } from "@/lib/api";
import { SITE_URL } from "@/lib/format";

export default function ProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const product = useApi(() => getProduct(id), [id]);
  const store = useApi(getStore, []);
  const [confirm, setConfirm] = useState(false);

  if (product.error) {
    return (
      <>
        <PageHeader title="Product" back={{ href: "/products", label: "Products" }} />
        <ErrorState title={product.error.includes("not found") ? "We can't find that product." : undefined} message={product.error} onRetry={product.reload} />
      </>
    );
  }

  if (!product.data) {
    return (
      <>
        <Skeleton className="mb-8 h-12 w-72" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[520px] rounded-card" />
          <Skeleton className="h-[520px] rounded-card" />
        </div>
      </>
    );
  }

  const p = product.data;
  const url = store.data ? `${SITE_URL}/${store.data.slug}/${p.slug}` : "";
  const embed = `<script src="https://${SITE_URL}/embed.js" data-product="${p.id}" async></script>`;

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title={<span className="flex flex-wrap items-center gap-3">{p.title} <StatusPill status={p.status} /></span>}
        description={
          <>
            {p.salesCount} sold · <MoneyText value={p.revenue} /> earned ·{" "}
            <Link href={`/orders?product=${p.id}`} className="font-medium text-foreground underline underline-offset-4">See orders</Link>
          </>
        }
        actions={
          p.status === "published" && store.data ? (
            <Button asChild variant="secondary">
              <Link href={`/s/${store.data.slug}/${p.slug}`} target="_blank">View on store <ExternalLink aria-hidden /></Link>
            </Button>
          ) : null
        }
      />
      <ProductForm
        key={p.updatedAt}
        initial={toValues(p)}
        onSubmit={async (v) => {
          try {
            const saved = await updateProduct(p.id, toInput(v));
            toast.success(saved.status === "published" ? "Saved and live" : "Saved");
            product.setData(saved);
          } catch (e) {
            toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
        aside={
          <>
            <section className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6" aria-label="Share">
              <h2 className="font-sans text-base font-semibold tracking-normal">Share and embed</h2>
              {url && <CopyField label="Product link" value={`https://${url}`} display={url} />}
              <CopyField label="Embed on any website" value={embed} multiline toastText="Embed code copied" />
            </section>
            <section className="flex flex-col gap-3 rounded-card border border-danger/25 bg-surface p-5 md:p-6" aria-label="Danger zone">
              <h2 className="font-sans text-base font-semibold tracking-normal">Remove</h2>
              <p className="text-sm text-muted-foreground">Archive hides it but keeps the history. Delete removes it for good.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    const saved = await updateProduct(p.id, { status: "archived" });
                    product.setData(saved);
                    toast.success("Archived");
                  }}
                >
                  <Archive aria-hidden /> Archive
                </Button>
                <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              </div>
            </section>
          </>
        }
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete “${p.title}”?`}
        description="It disappears from your store. Past buyers keep their downloads. This can't be undone."
        confirmLabel="Delete product"
        onConfirm={async () => {
          await deleteProduct(p.id);
          toast.success("Product deleted");
          router.push("/products");
        }}
      />
    </>
  );
}
