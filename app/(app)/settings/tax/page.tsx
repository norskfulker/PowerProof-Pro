"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SaveBar } from "@/components/save/save-bar";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useFormSaveBar } from "@/hooks/use-dirty-form";
import { TaxCodes } from "@/components/settings/tax-codes";
import { useApi } from "@/hooks/use-api";
import { deleteTaxCode, getInvoiceSettings, getTaxCodes, saveTaxCode, updateInvoiceSettings } from "@/lib/api";
import type { InvoiceSettings } from "@/lib/types";

const schema = z.object({
  prefix: z.string().trim().min(1, "Add a short prefix like INV.").max(8, "Up to 8 characters.").regex(/^[A-Z0-9-/]+$/i, "Letters, numbers, dashes and slashes only."),
  footerNote: z.string().max(200, "Keep it under 200 characters."),
});
type Values = z.input<typeof schema>;

function InvoiceForm({ settings }: { settings: InvoiceSettings }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: settings, mode: "onTouched" });
  const bar = useFormSaveBar(
    form,
    async (raw) => {
      const v = schema.parse(raw);
      await updateInvoiceSettings({ prefix: v.prefix.toUpperCase(), footerNote: v.footerNote });
    },
    "Invoice settings saved"
  );
  return (
    <Form {...form}>
      <form
        id="invoice"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          bar.save();
        }}
      >
        <SettingsSection
          title="Tax invoices"
          description="Every paid order gets a numbered invoice. Numbers never repeat or go backwards."
          saveBar={<SaveBar state={bar} />}
                  >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="prefix" render={({ field }) => (
              <FormItem><FormLabel>Number prefix</FormLabel><FormControl><Input className="font-mono uppercase" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <p className="text-sm text-muted-foreground">Invoice numbers run in one unbroken series and are set by PowerProof when an order is paid. Your GSTIN is printed whenever you have saved one in Company details, and prices include GST.</p>
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
  if (!codes.data || !invoice.data) return <SettingsLoading error={codes.error ?? invoice.error} onRetry={() => { codes.reload(); invoice.reload(); }} />;
  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="HSN and SAC codes" description="Each product carries one code and its GST rate; that decides the GST line on the invoice. Use a listed code or add your own.">
        <TaxCodes codes={codes.data} onAdd={async (c) => codes.setData(await saveTaxCode(c))} onDelete={async (id) => codes.setData(await deleteTaxCode(id))} />
      </SettingsSection>
      <InvoiceForm settings={invoice.data} />
    </div>
  );
}
