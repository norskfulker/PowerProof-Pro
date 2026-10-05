"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplatePreview } from "@/components/pages/template-preview";
import { PageHeader } from "@/components/pp/page-header";
import { TemplateCard } from "@/components/pp/template-card";
import { useApi } from "@/hooks/use-api";
import { createPage, getProducts } from "@/lib/api";
import { TEMPLATES } from "@/lib/templates";
import type { PageTemplate } from "@/lib/types";

export default function NewPagePage() {
  const router = useRouter();
  const products = useApi(() => getProducts({ status: "all" }), []);
  const [template, setTemplate] = useState<PageTemplate>("launch");
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function create() {
    if (title.trim().length < 2) {
      setError("Name the page so you can find it later.");
      return;
    }
    setPending(true);
    try {
      const mode = template === "blank" ? "html" : "visual";
      const page = await createPage(template, title.trim(), productId || undefined, mode);
      toast.success("Page created");
      router.push(mode === "html" ? `/pages/${page.id}/html` : `/pages/${page.id}/edit`);
    } catch (e) {
      toast.error("Couldn't create the page", { description: e instanceof Error ? e.message : undefined });
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader back={{ href: "/pages", label: "Pages" }} title="Pick a template" description="Start close to done. Everything is editable, and Blank lets you paste your own HTML." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} selected={template === t.id} onSelect={() => setTemplate(t.id)} />
          ))}
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-card border bg-surface">
            <p className="eyebrow border-b px-4 py-2.5">Preview</p>
            <div className="max-h-80 overflow-y-auto">
              <TemplatePreview template={template} />
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-card border bg-surface p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-title">Page name</Label>
              <Input
                id="pg-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(undefined);
                }}
                placeholder="Launch page"
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "pg-title-e" : undefined}
              />
              {error && <p id="pg-title-e" className="text-sm font-medium text-danger">{error}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-product">Sells</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="pg-product" className="w-full">
                  <SelectValue placeholder={products.loading ? "Loading…" : "Pick a product (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {products.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={create} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {template === "blank" ? "Open HTML editor" : "Open visual editor"} <ArrowRight aria-hidden />
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
