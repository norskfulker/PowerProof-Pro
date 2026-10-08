import { z } from "zod";

const money = z.object({ amount: z.number().int(), currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"]) });

export const productSchema = z
  .object({
    title: z.string().trim().min(3, "Give it a name buyers will understand.").max(120, "Keep it under 120 characters."),
    description: z.string().trim().min(20, "Write at least a sentence about what's inside.").max(5000),
    fulfilment: z.enum(["digital", "physical"]),
    kind: z.enum(["ebook", "template", "preset", "notion", "course", "audio", "other"]),
    price: money
      .refine((m) => m.amount >= (m.currency === "INR" ? 1000 : 100), (m) => ({ message: m.currency === "INR" ? "₹10.00 is the minimum price." : "The minimum price is 1.00." }))
      .refine((m) => m.amount <= (m.currency === "INR" ? 50000000 : 100000000), "That price is too high. Talk to us for big tickets."),
    compareAt: money.optional(),
    images: z
      .array(z.object({ id: z.string(), alt: z.string(), src: z.string().optional(), cover: z.any().optional(), focal: z.object({ x: z.number(), y: z.number() }).optional() }))
      .max(8, "Up to 8 images. Remove one to add another."),
    video: z.object({ src: z.string(), alt: z.string(), poster: z.string().optional(), kind: z.enum(["image", "gif", "video"]).optional(), focal: z.object({ x: z.number(), y: z.number() }).optional() }).optional(),
    tileBackground: z.any().optional(),
    files: z.array(z.object({ id: z.string(), name: z.string(), size: z.number(), mime: z.string() })),
    sku: z
      .string()
      .trim()
      .max(32, "SKUs are 32 characters at most.")
      .regex(/^[A-Za-z0-9-_]*$/, "Use letters, numbers, dashes and underscores."),
    taxCode: z.string().regex(/^\d{4,8}$/, "Tax codes are 4 to 8 digits."),
    taxRate: z.number({ message: "Enter the GST rate." }).min(0, "GST can't be negative.").max(40, "GST is 40% at most.").optional(),
    status: z.enum(["published", "draft", "archived"]),
    sourceUrl: z.string().optional(),
    /** Optional: collections only help organize products, nothing requires one */
    collectionIds: z.array(z.string()).optional(),
  })
  .refine((v) => !v.compareAt || v.compareAt.amount > v.price.amount, { path: ["compareAt"], message: "The original price should be higher than the price." })
  // Only a digital product has something to download
  .refine((v) => v.status !== "published" || v.fulfilment === "physical" || v.files.length > 0, {
    path: ["files"],
    message: "Add at least one file before publishing. Buyers need something to download.",
  })
  // A physical product lives in a collection, so buyers can browse to it
  .refine((v) => v.fulfilment !== "physical" || (v.collectionIds?.length ?? 0) > 0, {
    path: ["collectionIds"],
    message: "Put this product in a collection. Physical products need one so buyers can find them.",
  });

export type ProductValues = z.infer<typeof productSchema>;
