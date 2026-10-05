"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SaveButton, SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { TaxCodes } from "@/components/settings/tax-codes";
import { useApi } from "@/hooks/use-api";
import { getInvoiceSettings, getOrders, getTaxCodes, updateInvoiceSettings } from "@/lib/api";
import type { InvoiceSettings } from "@/lib/types";

const schema = z.object({
  prefix: z.string().trim().min(1, "Add a short prefix like INV.").max(8, "Up to 8 characters.").regex(/^[A-Z0-9-/]+$/i, "Letters, numbers, dashes and slashes only."),
  nextNumber: z.coerce.number().int().min(1, "Start from 1 or more."),
  showGstin: z.boolean(),
  pricesIncludeTax: z.boolean(),
  footerNote: z.string().max(200, "Keep it under 200 characters."),
  defaultTaxCode: z.string(),
});
type Values = z.input<typeof schema>;

function InvoiceForm({ settings, sampleOrderId }: { settings: InvoiceSettings; sampleOrderId?: string }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: settings, mode: "onTouched" });
  return (
    <Form {...form}>
      <form
        id="invoice"
        noValidate
        onSubmit={form.handleSubmit(async (raw) => {
          const v = schema.parse(raw);
          const s = await updateInvoiceSettings({ ...v, prefix: v.prefix.toUpperCase() });
          form.reset(s);
          toast.success("Invoice settings saved");
        })}
      >
        <SettingsSection
          title="Tax invoices"
          description="Every paid order gets a numbered invoice. Numbers never repeat or go backwards."
          footer={
            <>
              {sampleOrderId && <Button asChild variant="ghost"><Link href={`/invoice/${sampleOrderId}`} target="_blank">Preview an invoice <ExternalLink aria-hidden /></Link></Button>}
              <SaveButton form="invoice" pending={form.formState.isSubmitting} dirty={form.formState.isDirty} />
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="prefix" render={({ field }) => (
              <FormItem><FormLabel>Number prefix</FormLabel><FormControl><Input className="font-mono uppercase" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="nextNumber" render={({ field }) => (
              <FormItem><FormLabel>Next number</FormLabel><FormControl><Input inputMode="numeric" className="font-mono" {...field} value={String(field.value)} /></FormControl><FormDescription>Next invoice: {String(form.getValues("prefix")).toUpperCase()}-{String(field.value).padStart(4, "0")}</FormDescription><FormMessage /></FormItem>
            )} />
            {([
              ["showGstin", "Show my GSTIN", "Turn off if you're not registered yet."],
              ["pricesIncludeTax", "Prices include GST", "The tax is worked out from inside the price. Off adds it on top at checkout."],
            ] as const).map(([name, label, desc]) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <label className="flex min-h-11 items-center justify-between gap-4">
                    <span><span className="block font-medium">{label}</span><span className="block text-sm text-muted-foreground">{desc}</span></span>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} /></FormControl>
                  </label>
                </FormItem>
              )} />
            ))}
            <FormField control={form.control} name="footerNote" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Footer note</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </SettingsSection>
      </form>
    </Form>
  );
}

export default function TaxSettingsPage() {
  const codes = useApi(getTaxCodes, []);
  const invoice = useApi(getInvoiceSettings, []);
  const orders = useApi(() => getOrders({ status: "paid", limit: 1 }), []);
  if (!codes.data || !invoice.data) return <SettingsLoading error={codes.error ?? invoice.error} onRetry={() => { codes.reload(); invoice.reload(); }} />;
  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="HSN and SAC codes" description="Each product carries one. It decides the GST line on the invoice.">
        <TaxCodes codes={codes.data} onChange={codes.setData} />
      </SettingsSection>
      <InvoiceForm settings={invoice.data} sampleOrderId={orders.data?.[0]?.id} />
    </div>
  );
}
