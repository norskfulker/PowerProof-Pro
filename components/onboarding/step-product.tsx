"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link2, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormError } from "@/components/auth/auth-card";
import { CurrencyInput } from "@/components/pp/currency-input";
import { FileDrop } from "@/components/pp/file-drop";
import { ProductImageView } from "@/components/pp/product-cover";
import { autofillFromLink, createProduct } from "@/lib/api";
import type { Product, ProductImage } from "@/lib/types";
import { StepFrame } from "./step-frame";

const schema = z
  .object({
    title: z.string().trim().min(3, "Give it a name buyers will understand."),
    price: z.object({ amount: z.number(), currency: z.literal("INR") }, { required_error: "Set a price. ₹10.00 is the minimum." }).refine((p) => p.amount >= 1000, "₹10.00 is the minimum price."),
    files: z.array(z.object({ id: z.string(), name: z.string(), size: z.number(), mime: z.string() })),
    mode: z.enum(["upload", "link"]),
    sourceUrl: z.string().optional(),
  })
  .refine((v) => v.files.length > 0, { path: ["files"], message: "Add the file buyers will download." });

type Values = z.infer<typeof schema>;

export function StepProduct({ onDone, onBack }: { onDone: (p: Product) => void; onBack: () => void }) {
  const [error, setError] = useState<string>();
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [description, setDescription] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", files: [], mode: "upload" },
    mode: "onTouched",
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const fieldErr = form.formState.errors;

  async function fetchLink() {
    setError(undefined);
    setFetching(true);
    try {
      const r = await autofillFromLink(url.trim());
      form.setValue("title", r.title, { shouldValidate: true });
      form.setValue("price", { amount: r.price.amount, currency: "INR" }, { shouldValidate: true });
      form.setValue("sourceUrl", r.url);
      setImages(r.images);
      setDescription(r.description);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that link.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <StepFrame
      formId="step-product"
      title="Add your first product"
      description="Just the basics. Images, pages and the rest can wait."
      timeLeft="About a minute to go"
      onBack={onBack}
      submitLabel="Save product"
      pending={form.formState.isSubmitting}
    >
      <form
        id="step-product"
        noValidate
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(async (v) => {
          setError(undefined);
          try {
            const p = await createProduct({
              title: v.title.trim(),
              description: description || `${v.title.trim()}. Instant download after payment.`,
              kind: "other",
              price: v.price,
              images: images.length
                ? images
                : [{ id: "cover", alt: `${v.title} cover`, cover: { template: "split", title: v.title.trim(), subtitle: "Digital download", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" } }],
              files: v.files,
              sku: "",
              taxCode: "998433",
              status: "draft",
              sourceUrl: v.sourceUrl,
            });
            onDone(p);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
        })}
      >
        <FormError message={error} />
        <Tabs value={mode} onValueChange={(m) => form.setValue("mode", m as Values["mode"])}>
          <TabsList className="w-full">
            <TabsTrigger value="upload">
              <Upload aria-hidden /> Upload a file
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 aria-hidden /> Paste a link
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "link" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ob-url">Link to where you sell it now</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="ob-url" type="url" inputMode="url" placeholder="https://gumroad.com/l/your-product" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button type="button" variant="secondary" onClick={fetchLink} disabled={!url || fetching}>
                {fetching ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {fetching ? "Reading…" : "Fill it in"}
              </Button>
            </div>
            {images.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2" aria-label="Imported images">
                {images.map((i) => (
                  <ProductImageView key={i.id} image={i} size="sm" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-title" className={fieldErr.title && "text-danger"}>Product name</Label>
          <Input id="ob-title" aria-invalid={!!fieldErr.title || undefined} aria-describedby="ob-title-e" {...form.register("title")} />
          {fieldErr.title && <p id="ob-title-e" className="text-sm font-medium text-danger">{fieldErr.title.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-price" className={fieldErr.price && "text-danger"}>Price</Label>
          <Controller
            control={form.control}
            name="price"
            render={({ field }) => (
              <CurrencyInput
                id="ob-price"
                value={field.value}
                onChange={(m) => field.onChange(m ? { amount: m.amount, currency: "INR" } : undefined)}
                onBlur={field.onBlur}
                invalid={!!fieldErr.price}
                aria-describedby="ob-price-e"
              />
            )}
          />
          <p id="ob-price-e" className={fieldErr.price ? "text-sm font-medium text-danger" : "text-sm text-muted-foreground"}>
            {fieldErr.price?.message ?? "Buyers abroad see this in their own currency."}
          </p>
        </div>

        {(
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" id="ob-files-l">The file buyers get</span>
            <Controller
              control={form.control}
              name="files"
              render={({ field }) => (
                <FileDrop files={field.value} onChange={(f) => field.onChange(f)} invalid={!!fieldErr.files} describedBy="ob-files-e" />
              )}
            />
            {fieldErr.files && <p id="ob-files-e" className="text-sm font-medium text-danger">{fieldErr.files.message}</p>}
          </div>
        )}
      </form>
    </StepFrame>
  );
}
