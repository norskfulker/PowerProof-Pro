import { z } from "zod";

/**
 * Shipping for physical products: the creator ships, at flat rates per zone, optionally free over
 * an amount, and may offer cash on delivery. Pure: the server prices orders with it and the
 * checkout shows the same numbers. Amounts are minor units in the store's currency, GST included.
 */

export const shippingZoneSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Name the zone.").max(60),
  /** ISO country codes, or ["*"] for everywhere else */
  countries: z.array(z.string().regex(/^([A-Z]{2}|\*)$/)).min(1, "Pick at least one country.").max(250),
  /** Per order */
  rate: z.number().int().min(0).max(100_000_00),
  /** Free when the products come to at least this */
  freeOver: z.number().int().min(0).max(100_000_000_00).optional(),
  /** What buyers are told, like "3–5 days" */
  days: z.string().trim().max(40).optional(),
});
export type ShippingZone = z.infer<typeof shippingZoneSchema>;

export const shippingSettingsSchema = z.object({
  zones: z.array(shippingZoneSchema).max(20).default([]),
  cod: z
    .object({
      enabled: z.boolean().default(false),
      /** Added to COD orders */
      fee: z.number().int().min(0).max(10_000_00).default(0),
      /** COD is offered up to this order total */
      maxOrder: z.number().int().min(0).max(100_000_000_00).optional(),
    })
    .default({ enabled: false, fee: 0 }),
});
export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;

/** Cash on delivery is for buyers in the store's own country (couriers collect locally) */
export const COD_COUNTRY = "IN";

/** Whatever is stored, as settings that are safe to use (bad zones are dropped) */
export function shippingFrom(raw: unknown): ShippingSettings {
  const r = shippingSettingsSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  const zones = Array.isArray((raw as { zones?: unknown })?.zones) ? ((raw as { zones: unknown[] }).zones.map((z) => shippingZoneSchema.safeParse(z)).filter((x) => x.success).map((x) => x.data!) as ShippingZone[]) : [];
  const cod = shippingSettingsSchema.shape.cod.safeParse((raw as { cod?: unknown })?.cod);
  return { zones, cod: cod.success ? cod.data : { enabled: false, fee: 0 } };
}

/** The zone for a country: one that names it, else the "everywhere else" zone */
export function zoneFor(s: ShippingSettings, country: string): ShippingZone | undefined {
  return s.zones.find((z) => z.countries.includes(country)) ?? s.zones.find((z) => z.countries.includes("*"));
}

export class ShippingError extends Error {}

export interface ShippingQuote {
  shipping: number;
  codFee: number;
  zone?: ShippingZone;
}

/**
 * What shipping (and COD) adds to an order. `goods` is what the physical products come to after
 * discounts. Throws ShippingError with a buyer-facing reason when the store can't ship there or
 * COD isn't available for this order.
 */
export function quoteShipping(s: ShippingSettings, input: { country: string; goods: number; physical: boolean; cod: boolean; onlyPhysical: boolean; total: number }): ShippingQuote {
  if (input.cod) {
    if (!s.cod.enabled) throw new ShippingError("This store doesn't take cash on delivery.");
    if (!input.physical || !input.onlyPhysical) throw new ShippingError("Cash on delivery is only for orders where everything is shipped.");
    if (input.country !== COD_COUNTRY) throw new ShippingError("Cash on delivery is only available in India.");
  }
  if (!input.physical) return { shipping: 0, codFee: 0 };
  const zone = zoneFor(s, input.country);
  if (!zone) throw new ShippingError("This store doesn't ship to that country yet.");
  const shipping = zone.freeOver !== undefined && input.goods >= zone.freeOver ? 0 : zone.rate;
  const codFee = input.cod ? s.cod.fee : 0;
  if (input.cod && s.cod.maxOrder !== undefined && input.total + shipping + codFee > s.cod.maxOrder) throw new ShippingError("This order is too large for cash on delivery. Pay online instead.");
  return { shipping, codFee, zone };
}

/**
 * GST inside the shipping (and COD) charge. Shipping goods with them is one supply, taxed at the
 * rate of the main item: the highest rate among the physical products. Only for a GST-registered
 * seller selling to a buyer in India.
 */
export function shippingTax(charge: number, physicalRatesBps: number[], country: string, registered: boolean): number {
  if (!registered || country !== "IN" || charge <= 0 || !physicalRatesBps.length) return 0;
  const rate = Math.max(...physicalRatesBps) / 10000;
  return rate > 0 ? charge - Math.round(charge / (1 + rate)) : 0;
}

/** The buyer's address. Phone is for the courier. */
export const shipToSchema = z.object({
  name: z.string().trim().min(2, "Enter the name for delivery.").max(120),
  phone: z.string().trim().min(6, "Enter a phone number for the courier.").max(30),
  line1: z.string().trim().min(3, "Enter the street address.").max(200),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2, "Enter the city.").max(100),
  state: z.string().trim().max(100).default(""),
  pincode: z.string().trim().min(3, "Enter the PIN or postal code.").max(12),
  country: z.string().regex(/^[A-Z]{2}$/),
}).superRefine((a, ctx) => {
  if (a.country === "IN" && !/^[1-9]\d{5}$/.test(a.pincode)) ctx.addIssue({ code: "custom", path: ["pincode"], message: "Indian PIN codes are 6 digits." });
  if (a.country === "IN" && !a.state) ctx.addIssue({ code: "custom", path: ["state"], message: "Pick the state." });
});
export type ShipTo = z.infer<typeof shipToSchema>;
