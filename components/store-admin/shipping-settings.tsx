"use client";

import { useState } from "react";
import { HandCoins, Plus, Trash2, Truck, X } from "lucide-react";
import { CurrencyInput } from "@/components/pp/currency-input";
import { SaveBar } from "@/components/save/save-bar";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { updateStore } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { shippingFrom, shippingSettingsSchema, type ShippingSettings, type ShippingZone } from "@/lib/shipping";
import type { Store } from "@/lib/types";
import { uid } from "@/lib/uid";

const EVERYWHERE = "*";
const countryName = (c: string) => (c === EVERYWHERE ? "Everywhere else" : COUNTRIES.find((x) => x.code === c)?.name ?? c);

/** A first zone for the store's own country, so setting up is one click */
const starter = (store: Store): ShippingZone => ({ id: uid("zone"), name: countryName(store.country), countries: [store.country], rate: store.currency === "INR" ? 5000 : 500, days: "3–5 days" });

/**
 * Shipping for physical products: zones (countries) at a flat rate per order, free over an amount
 * if you like, and cash on delivery. Checkout charges exactly this.
 */
export function ShippingSettingsSection({ store, onSaved }: { store: Store; onSaved: (s: Store) => void }) {
  const saved = shippingFrom(store.shipping);
  const [value, setValue] = useState<ShippingSettings>(saved);
  const state = useDirtyForm({
    value,
    saved,
    validate: () => shippingSettingsSchema.safeParse(value).success,
    onSave: async (v) => onSaved(await updateStore({ shipping: v })),
    onDiscard: () => setValue(saved),
    savedMessage: "Shipping saved",
  });
  const problem = shippingSettingsSchema.safeParse(value);
  const setZone = (i: number, patch: Partial<ShippingZone>) => setValue({ ...value, zones: value.zones.map((z, j) => (j === i ? { ...z, ...patch } : z)) });
  const used = new Set(value.zones.flatMap((z) => z.countries));
  const cur = store.currency;

  return (
    <SettingsSection title="Shipping" description="For physical products. You send the parcels; buyers pay a flat rate per order for where they are." saveBar={<SaveBar state={state} />}>
      {value.zones.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-dashed p-5">
          <Truck className="size-6 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Physical products can&apos;t be bought until you say where you ship and what it costs.</p>
          <Button type="button" onClick={() => setValue({ ...value, zones: [starter(store)] })}>
            <Plus aria-hidden /> Ship to {countryName(store.country)}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {value.zones.map((z, i) => (
            <li key={z.id} className="flex flex-col gap-4 rounded-card border bg-surface-sunken p-4">
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor={`z-${i}-name`}>Zone name</Label>
                  <Input id={`z-${i}-name`} value={z.name} maxLength={60} onChange={(e) => setZone(i, { name: e.target.value })} />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${z.name || "this zone"}`} onClick={() => setValue({ ...value, zones: value.zones.filter((_, j) => j !== i) })}>
                  <Trash2 />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium" id={`z-${i}-c`}>Countries</span>
                <div className="flex flex-wrap items-center gap-1.5" aria-labelledby={`z-${i}-c`}>
                  {z.countries.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-background py-0.5 pr-1 pl-2.5 text-sm">
                      {countryName(c)}
                      <button type="button" className="grid size-6 place-items-center rounded-full hover:bg-muted" aria-label={`Remove ${countryName(c)}`} onClick={() => setZone(i, { countries: z.countries.filter((x) => x !== c) })}>
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <Select value="" onValueChange={(c) => setZone(i, { countries: [...z.countries, c] })}>
                    <SelectTrigger size="sm" className="h-9 w-44" aria-label="Add a country"><SelectValue placeholder="Add a country" /></SelectTrigger>
                    <SelectContent>
                      {!used.has(EVERYWHERE) && <SelectItem value={EVERYWHERE}>Everywhere else</SelectItem>}
                      {COUNTRIES.filter((c) => !used.has(c.code)).map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`z-${i}-rate`}>Rate per order</Label>
                  <CurrencyInput id={`z-${i}-rate`} currency={cur} value={{ amount: z.rate, currency: cur }} onChange={(m) => setZone(i, { rate: Math.max(0, m?.amount ?? 0) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`z-${i}-free`}>Free over <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <CurrencyInput id={`z-${i}-free`} currency={cur} value={z.freeOver !== undefined ? { amount: z.freeOver, currency: cur } : undefined} onChange={(m) => setZone(i, { freeOver: m && m.amount > 0 ? m.amount : undefined })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`z-${i}-days`}>Delivery time</Label>
                  <Input id={`z-${i}-days`} value={z.days ?? ""} maxLength={40} placeholder="3–5 days" onChange={(e) => setZone(i, { days: e.target.value || undefined })} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {value.zones.length > 0 && value.zones.length < 20 && (
        <Button type="button" variant="secondary" className="mt-3 self-start" onClick={() => setValue({ ...value, zones: [...value.zones, { id: uid("zone"), name: used.has(EVERYWHERE) ? "New zone" : "Everywhere else", countries: used.has(EVERYWHERE) ? [] : [EVERYWHERE], rate: 0 }] })}>
          <Plus aria-hidden /> Add a zone
        </Button>
      )}

      <div className="mt-6 flex flex-col gap-4 border-t pt-5">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="flex items-start gap-3">
            <HandCoins className="mt-0.5 size-5 text-primary" aria-hidden />
            <span>
              <span className="block font-medium">Cash on delivery</span>
              <span className="block text-sm text-muted-foreground">Buyers in India pay the courier. You collect the cash and mark it collected; PowerProof&apos;s fee comes out of your balance.</span>
            </span>
          </span>
          <Switch checked={value.cod.enabled} onCheckedChange={(enabled) => setValue({ ...value, cod: { ...value.cod, enabled } })} aria-label="Cash on delivery" />
        </label>
        {value.cod.enabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cod-fee">Extra charge for cash on delivery</Label>
              <CurrencyInput id="cod-fee" currency={cur} value={{ amount: value.cod.fee, currency: cur }} onChange={(m) => setValue({ ...value, cod: { ...value.cod, fee: Math.max(0, m?.amount ?? 0) } })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cod-max">Only for orders up to <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <CurrencyInput id="cod-max" currency={cur} value={value.cod.maxOrder !== undefined ? { amount: value.cod.maxOrder, currency: cur } : undefined} onChange={(m) => setValue({ ...value, cod: { ...value.cod, maxOrder: m && m.amount > 0 ? m.amount : undefined } })} />
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Rates include GST. With a GSTIN, shipping is taxed at the rate of the main item in the order and shown on the invoice.</p>
      {!problem.success && <p role="alert" className="mt-3 text-sm font-medium text-danger">{problem.error.issues[0]?.message}</p>}
    </SettingsSection>
  );
}
