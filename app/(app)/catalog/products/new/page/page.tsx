"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/auth/auth-card";
import { CurrencyInput } from "@/components/pp/currency-input";
import { PageHeader } from "@/components/pp/page-header";
import { TemplateCard } from "@/components/pp/template-card";
import { createPage, createProduct } from "@/lib/api";
import { money } from "@/lib/money";
import { TEMPLATES } from "@/lib/templates";
import type { Money, PageTemplate } from "@/lib/types";

export default function PageProductPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<Money | undefined>(money(49900));
  const [template, setTemplate] = useState<PageTemplate>("launch");
  const [errors, setErrors] = useState<{ title?: string; price?: string; form?: string }>({});
  const [pending, setPending] = useState<"visual" | "html" | null>(null);

  async function go(mode: "visual" | "html") {
    const e: typeof errors = {};
    if (title.trim().length < 3) e.title = "Give it a name buyers will understand.";
    if (!price || price.amount < 1000) e.price = "₹10.00 is the minimum price.";
    setErrors(e);
    if (e.title || e.price) return;
    setPending(mode);
    try {
      const product = await createProduct({
        title: title.trim(),
        description: `${title.trim()}. Instant download after payment.`,
        kind: "other",
        price: price!,
        images: [{ id: "cover", alt: `${title} cover`, cover: { template: "split", title: title.trim(), subtitle: "Digital download", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" } }],
        files: [],
        sku: "",
        taxCode: "998433",
        status: "draft",
      });
      const page = await createPage(mode === "html" ? "blank" : template, `${title.trim()} page`, product.id, mode);
      toast.success("Product and page created", { description: "Add the file from the product editor before publishing." });
      router.push(mode === "html" ? `/catalog/sales-pages/${page.id}/html` : `/catalog/sales-pages/${page.id}/edit`);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Something went wrong." });
      setPending(null);
    }
  }

  return (
    <>
      <PageHeader back={{ href: "/catalog/products/new", label: "Add a product" }} eyebrow="Create a page" title="A product with its own page" description="Name it, price it, pick a look. You'll land in the editor next." />
      <div className="flex flex-col gap-8">
        <section className="grid grid-cols-1 gap-4 rounded-card border bg-surface p-5 md:grid-cols-2 md:p-6" aria-label="Basics">
          <FormError message={errors.form} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pp-title">Product name</Label>
            <Input id="pp-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title || undefined} aria-describedby="pp-title-e" />
            {errors.title && <p id="pp-title-e" className="text-sm font-medium text-danger">{errors.title}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pp-price">Price</Label>
            <CurrencyInput id="pp-price" value={price} onChange={setPrice} invalid={!!errors.price} aria-describedby="pp-price-e" />
            {errors.price && <p id="pp-price-e" className="text-sm font-medium text-danger">{errors.price}</p>}
          </div>
        </section>

        <section aria-labelledby="tpl-h">
          <h2 id="tpl-h" className="mb-4 text-xl">Pick a template</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.filter((t) => t.id !== "blank").map((t) => (
              <TemplateCard key={t.id} template={t} selected={template === t.id} onSelect={() => setTemplate(t.id)} />
            ))}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => go("html")} disabled={!!pending}>
            {pending === "html" ? <Loader2 className="animate-spin" aria-hidden /> : <Code2 aria-hidden />}
            Paste my own HTML instead
          </Button>
          <Button onClick={() => go("visual")} disabled={!!pending}>
            {pending === "visual" && <Loader2 className="animate-spin" aria-hidden />}
            Open the editor
          </Button>
        </div>
      </div>
    </>
  );
}
