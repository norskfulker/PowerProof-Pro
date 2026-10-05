import { z } from "zod";

const money = z.object({ amount: z.number().int(), currency: z.literal("INR") });

export const productSchema = z
  .object({
    title: z.string().trim().min(3, "Give it a name buyers will understand.").max(120, "Keep it under 120 characters."),
    description: z.string().trim().min(20, "Write at least a sentence about what's inside.").max(5000),
    kind: z.enum(["ebook", "template", "preset", "notion", "course", "audio", "other"]),
    price: money.refine((m) => m.amount >= 1000, "₹10.00 is the minimum price.").refine((m) => m.amount <= 50000000, "That's over ₹5,00,000. Talk to us for big tickets."),
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
    taxCode: z.string().min(4, "Pick a tax code."),
    status: z.enum(["published", "draft", "archived"]),
    sourceUrl: z.string().optional(),
  })
  .refine((v) => !v.compareAt || v.compareAt.amount > v.price.amount, { path: ["compareAt"], message: "The original price should be higher than the price." })
  .refine((v) => v.status !== "published" || v.files.length > 0, {
    path: ["files"],
    message: "Add at least one file before publishing. Buyers need something to download.",
  });

export type ProductValues = z.infer<typeof productSchema>;
