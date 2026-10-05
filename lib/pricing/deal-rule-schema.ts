import { z } from "zod";

/**
 * Validation for deal rules saved from the wizard. Messages are written for the creator.
 * The engine (deals.ts) tolerates bad data; this keeps it out in the first place.
 */
const money = z.object({ amount: z.number().int().min(100, "Set at least ₹1."), currency: z.literal("INR") });
const percent = z.number({ invalid_type_error: "Enter a percent." }).int("Use a whole number.").min(1, "At least 1%.").max(90, "At most 90%. Use a free gift for 100%.");
const ids = (min: number, msg: string) => z.array(z.string()).min(min, msg);

const spec = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bundle_discount"), productIds: ids(2, "Pick at least two products to sell together."), percent }),
  z.object({ kind: z.literal("free_gift"), triggerIds: z.array(z.string()), minSpend: money.optional(), giftId: z.string().min(1, "Pick the free gift.") }),
  z.object({ kind: z.literal("choose_gift"), triggerIds: z.array(z.string()), minSpend: money.optional(), giftIds: ids(2, "Pick at least two gifts to choose from.").max(4, "Up to four gifts keeps the choice easy.") }),
  z.object({
    kind: z.literal("tiers"),
    productIds: z.array(z.string()),
    tiers: z
      .array(z.object({ minItems: z.number().int().min(2, "Tiers start at 2 items."), percent }))
      .min(1, "Add at least one tier.")
      .max(4, "Up to four tiers.")
      .refine((t) => new Set(t.map((x) => x.minItems)).size === t.length, "Each tier needs a different item count.")
      .refine((t) => [...t].sort((a, b) => a.minItems - b.minItems).every((x, i, a) => i === 0 || x.percent > a[i - 1].percent), "Bigger tiers should save more."),
  }),
  z.object({ kind: z.literal("spend_threshold"), minSpend: money, percent }),
  z.object({ kind: z.literal("buy_x_get_cheapest"), productIds: z.array(z.string()), buy: z.number().int().min(2, "At least 2 items.").max(10, "At most 10 items.") }),
  z.object({ kind: z.literal("limited_time"), productIds: ids(1, "Pick at least one product."), percent }),
]);

export const dealRuleSchema = z
  .intersection(
    spec,
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2, "Give it a name only you will see.").max(60, "Keep the name under 60 characters."),
      active: z.boolean(),
      stackable: z.boolean(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    })
  )
  .superRefine((r, ctx) => {
    if (r.startsAt && r.endsAt && Date.parse(r.endsAt) <= Date.parse(r.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End after it starts." });
    if (r.kind === "limited_time" && !r.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "A limited-time deal needs an end date." });
    if (r.kind === "free_gift" && r.triggerIds.includes(r.giftId)) ctx.addIssue({ code: "custom", path: ["giftId"], message: "The gift can't also be the product that unlocks it." });
  });

export type DealRuleInput = z.infer<typeof dealRuleSchema>;
