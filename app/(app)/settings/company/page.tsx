"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveButton, SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useApi } from "@/hooks/use-api";
import { getCompany, updateCompany } from "@/lib/api";
import { BUSINESS_TYPES, GSTIN_RE, INDIAN_STATES, PAN_RE, PINCODE_RE } from "@/lib/india";
import type { Company } from "@/lib/types";

const opt = (re: RegExp, msg: string) => z.string().trim().toUpperCase().refine((s) => s === "" || re.test(s), msg);

const schema = z
  .object({
    legalName: z.string().trim().min(2, "Enter the legal name for invoices."),
    businessType: z.enum(["individual", "proprietorship", "partnership", "llp", "private_limited"]),
    gstin: opt(GSTIN_RE, "GSTINs are 15 characters, like 27ABCPR1234F1Z5."),
    pan: opt(PAN_RE, "PANs are 10 characters, like ABCPR1234F."),
    address1: z.string().trim().min(3, "Enter the first line of your address."),
    address2: z.string().optional(),
    city: z.string().trim().min(2, "Enter your city."),
    state: z.string().min(1, "Pick your state."),
    pincode: z.string().regex(PINCODE_RE, "PIN codes are 6 digits."),
    country: z.string(),
  })
  .refine((v) => !v.gstin || !v.pan || v.gstin.slice(2, 12) === v.pan, { path: ["gstin"], message: "The PAN inside this GSTIN doesn't match your PAN." });

type Values = z.input<typeof schema>;

function CompanyForm({ company, onSaved }: { company: Company; onSaved: (c: Company) => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ...company, gstin: company.gstin ?? "", pan: company.pan ?? "", address2: company.address2 ?? "" },
    mode: "onTouched",
  });
  const text = (name: keyof Values, label: string, opts: { mono?: boolean; desc?: string; span?: boolean; auto?: string; max?: number } = {}) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className={opts.span ? "sm:col-span-2" : undefined}>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input {...field} value={(field.value as string) ?? ""} autoComplete={opts.auto} maxLength={opts.max} className={opts.mono ? "font-mono uppercase" : undefined} /></FormControl>
        {opts.desc && <FormDescription>{opts.desc}</FormDescription>}
        <FormMessage />
      </FormItem>
    )} />
  );

  return (
    <Form {...form}>
      <form
        id="company"
        noValidate
        onSubmit={form.handleSubmit(async (raw) => {
          const v = schema.parse(raw);
          const c = await updateCompany({ ...v, gstin: v.gstin || undefined, pan: v.pan || undefined });
          onSaved(c);
          form.reset({ ...c, gstin: c.gstin ?? "", pan: c.pan ?? "", address2: c.address2 ?? "" });
          toast.success("Company details saved", { description: "New invoices use them straight away." });
        })}
      >
        <SettingsSection title="Company details" description="Printed on every tax invoice. Leave GSTIN blank if you're not registered." footer={<SaveButton form="company" pending={form.formState.isSubmitting} dirty={form.formState.isDirty} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("legalName", "Legal name", { span: true, auto: "organization" })}
            <FormField control={form.control} name="businessType" render={({ field }) => (
              <FormItem>
                <FormLabel>Business type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{BUSINESS_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <div />
            {text("gstin", "GSTIN", { mono: true, max: 15, desc: "15 characters. Optional." })}
            {text("pan", "PAN", { mono: true, max: 10, desc: "Needed for TDS and payouts above ₹50,000 a year." })}
            {text("address1", "Address", { span: true, auto: "address-line1" })}
            {text("address2", "Address line 2 (optional)", { span: true, auto: "address-line2" })}
            {text("city", "City", { auto: "address-level2" })}
            <FormField control={form.control} name="state" render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                  <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {text("pincode", "PIN code", { mono: true, max: 6, auto: "postal-code" })}
            {text("country", "Country")}
          </div>
        </SettingsSection>
      </form>
    </Form>
  );
}

export default function CompanySettingsPage() {
  const { data, error, reload, setData } = useApi(getCompany, []);
  if (!data) return <SettingsLoading error={error} onRetry={reload} />;
  return <CompanyForm company={data} onSaved={setData} />;
}
