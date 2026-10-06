"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/pp/page-header";
import { usePlan } from "@/components/plan/plan-context";
import { ProductForm } from "@/components/products/product-form";
import { toInput, toValues } from "@/components/products/to-values";
import { autofillFromLink, createProduct } from "@/lib/api";
import type { LinkAutofill } from "@/lib/types";

const EXAMPLES = ["https://gumroad.com/l/notion-content-calendar", "https://www.instamojo.com/@riya/cold-email-swipe-file", "https://www.etsy.com/listing/1234/pitch-deck-template-pack"];

export default function LinkProductPage() {
  const router = useRouter();
  const plan = usePlan();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<LinkAutofill>();

  async function fetchIt(u = url) {
    const v = u.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(v)) {
      setError("Paste the full link, starting with https://");
      return;
    }
    setError(undefined);
    setLoading(true);
    setFound(undefined);
    try {
      setFound(await autofillFromLink(v));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that page. Try another link or upload the file instead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader back={{ href: "/catalog/products/new", label: "Add a product" }} eyebrow="Paste a link" title="Bring a product over" description="We read the page and fill in what we can. You check it before anything goes live." />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          fetchIt();
        }}
        className="mb-8 rounded-card border bg-surface p-5 md:p-6"
      >
        <Label htmlFor="src-url">Product link</Label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="src-url"
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://gumroad.com/l/your-product"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "src-err" : "src-help"}
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {loading ? "Reading the page…" : "Fill it in"}
          </Button>
        </div>
        {error ? (
          <p id="src-err" role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>
        ) : (
          <p id="src-help" className="mt-2 text-sm text-muted-foreground">
            Try one:{" "}
            {EXAMPLES.map((ex, i) => (
              <span key={ex}>
                <button type="button" className="inline-flex min-h-11 items-center font-mono text-xs text-foreground underline underline-offset-4" onClick={() => { setUrl(ex); fetchIt(ex); }}>
                  {new URL(ex).hostname.replace("www.", "")}
                </button>
                {i < EXAMPLES.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        )}
      </form>

      {loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true" aria-label="Reading the page">
          <div className="flex flex-col gap-4 rounded-card border bg-surface p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-36 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="aspect-[4/3]" />
              <Skeleton className="aspect-[4/3]" />
              <Skeleton className="aspect-[4/3]" />
            </div>
          </div>
          <Skeleton className="h-80 rounded-card" />
        </div>
      )}

      {found && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm" role="status">
            <Sparkles className="size-4 text-success" aria-hidden />
            <span className="flex-1">
              Found <strong>{found.title}</strong> on {found.sourceName}: title, price, description and {found.images.length} images. Add the file and check the wording.
            </span>
            <Button variant="ghost" size="sm" onClick={() => { setFound(undefined); setUrl(""); }}>
              <RotateCcw aria-hidden /> Start over
            </Button>
          </div>
          <ProductForm
            key={found.url}
            initial={toValues({
              title: found.title,
              description: found.description,
              kind: found.kind,
              price: found.price,
              images: found.images,
              files: [],
              sku: "",
              taxCode: "998433",
              status: "draft",
              sourceUrl: found.url,
            })}
            submitLabel="Create product"
            onSubmit={async (v) => {
              try {
                const p = await createProduct(toInput(v));
                toast.success(p.status === "published" ? "Product is live" : "Saved as a draft", { description: p.title });
                router.push("/catalog/products");
              } catch (e) {
                if (!plan.handleLimitError(e)) toast.error("Couldn't create it", { description: e instanceof Error ? e.message : undefined });
                throw e;
              }
            }}
          />
        </>
      )}
    </>
  );
}
