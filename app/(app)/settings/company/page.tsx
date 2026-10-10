"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lookupGstin, type GstLookup } from "@/lib/api";
import { isValidGstin, matchState, readGstin } from "@/lib/gstin";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveBar } from "@/components/save/save-bar";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useFormSaveBar } from "@/hooks/use-dirty-form";
import { useApi } from "@/hooks/use-api";
import { getCompany, updateCompany } from "@/lib/api";
import { BUSINESS_TYPES, GSTIN_RE, INDIAN_STATES, PAN_RE, PINCODE_RE } from "@/lib/india";
import type { Company } from "@/lib/types";

const opt = (re: RegExp, msg: string) => z.string().trim().toUpperCase().refine((s) => s === "" || re.test(s), msg);

/**
 * Only the invoice name is needed to sell: buyers see it at checkout and on every receipt and
 * invoice. GST is optional; once a GSTIN is entered, the legal name and address a tax invoice must
 * carry become required too.
 */
const schema = z
  .object({
    invoiceName: z.string().trim().min(2, "Add the name buyers should see on receipts and invoices.").max(120, "Keep it under 120 characters."),
    legalName: z.string().trim().max(150, "Keep it under 150 characters."),
    businessType: z.enum(["individual", "proprietorship", "partnership", "llp", "private_limited"]),
    gstin: opt(GSTIN_RE, "GSTINs are 15 characters, like 27ABCPR1234F1Z5."),
    pan: opt(PAN_RE, "PANs are 10 characters, like ABCPR1234F."),
    address1: z.string().trim(),
    address2: z.string().optional(),
    city: z.string().trim(),
    state: z.string(),
    pincode: z.string().trim().refine((v) => v === "" || PINCODE_RE.test(v), "PIN codes are 6 digits."),
    country: z.string(),
  })
  .refine((v) => !v.gstin || !v.pan || v.gstin.slice(2, 12) === v.pan, { path: ["gstin"], message: "The PAN inside this GSTIN doesn't match your PAN." })
  .superRefine((v, ctx) => {
    if (v.legalName && v.legalName.length < 2) ctx.addIssue({ code: "custom", path: ["legalName"], message: "Enter the full legal name, or leave it empty." });
    if (!v.gstin) return;
    // A GST invoice must name the registered business and its address
    const need: [keyof typeof v, boolean, string][] = [
      ["legalName", v.legalName.length >= 2, "Enter the legal name your GSTIN is registered to."],
      ["address1", v.address1.length >= 3, "Enter the first line of your registered address."],
      ["city", v.city.length >= 2, "Enter your city."],
      ["state", !!v.state, "Pick your state."],
      ["pincode", PINCODE_RE.test(v.pincode), "Enter your 6-digit PIN code."],
    ];
    for (const [path, ok, message] of need) if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
  });

type Values = z.input<typeof schema>;

/**
 * Once a GSTIN is typed correctly, ask the GST records who it belongs to. The state and PAN come
 * from the number itself straight away; the registered name and address come from the lookup and
 * are only put in the form when you say so.
 */
function GstinLookup({ form }: { form: UseFormReturn<Values> }) {
  const gstin = (useWatch({ control: form.control, name: "gstin" }) ?? "").toString().trim().toUpperCase();
  const [state, setState] = useState<{ for: string; result?: GstLookup }>({ for: "" });
  const checked = useRef("");
  const valid = isValidGstin(gstin);

  useEffect(() => {
    if (!valid || checked.current === gstin) return;
    // The number itself tells the state and the PAN: fill what's still empty
    const facts = readGstin(gstin);
    if (facts.state && !form.getValues("state")) form.setValue("state", facts.state, { shouldDirty: true });
    if (facts.pan && !form.getValues("pan")) form.setValue("pan", facts.pan, { shouldDirty: true });
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      checked.current = gstin;
      try {
        const result = await lookupGstin(gstin, ctl.signal);
        setState({ for: gstin, result });
      } catch {
        /* a newer GSTIN replaced this one */
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
      if (checked.current === gstin) checked.current = "";
    };
  }, [gstin, valid, form]);

  if (!gstin || gstin.length < 15) return null;
  if (!valid) return <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">That GSTIN doesn&apos;t look right. Check it for a typo.</p>;
  const r = state.for === gstin ? state.result : undefined;
  if (!r) return <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2" aria-live="polite"><Loader2 className="size-4 animate-spin" aria-hidden /> Looking up this GSTIN…</p>;
  if (!r.ok) {
    return (
      <p className="text-sm text-muted-foreground sm:col-span-2" aria-live="polite">
        {r.code === "not_connected" ? "The number checks out, and we've filled in your state and PAN from it. Live lookup of the registered name and address isn't connected yet." : r.message}
      </p>
    );
  }
  const c = r.company;
  const inactive = !!c.status && !/^active$/i.test(c.status);
  const stateName = matchState(c.state) ?? readGstin(gstin).state;
  return (
    <div className="flex flex-col gap-3 rounded-card border bg-surface-sunken p-4 sm:col-span-2" aria-live="polite" data-slot="gst-found">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {inactive ? <TriangleAlert className="size-4 text-warning-ink" aria-hidden /> : <BadgeCheck className="size-4 text-success" aria-hidden />}
        Found on the GST records{c.status ? ` · ${c.status}` : ""}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Legal name</dt><dd className="font-medium">{c.legalName}</dd>
        {c.tradeName && c.tradeName !== c.legalName && (<><dt className="text-muted-foreground">Trade name</dt><dd>{c.tradeName}</dd></>)}
        <dt className="text-muted-foreground">Address</dt>
        <dd>{[c.address1, c.address2, c.city, stateName, c.pincode].filter(Boolean).join(", ")}</dd>
      </dl>
      {inactive && <p className="text-sm text-warning-ink">This registration isn&apos;t active, so invoices with it may not be valid. Check with your GST filing.</p>}
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => {
          const set = (k: keyof Values, v: string | undefined) => v && form.setValue(k, v as never, { shouldDirty: true, shouldValidate: true });
          const facts = readGstin(gstin);
          set("legalName", c.legalName);
          set("address1", c.address1);
          set("address2", c.address2);
          set("city", c.city);
          set("state", stateName);
          set("pincode", c.pincode);
          set("pan", facts.pan);
          set("businessType", facts.businessType);
        }}
      >
        Use these details
      </Button>
    </div>
  );
}


function CompanyForm({ company, onSaved }: { company: Company; onSaved: (c: Company) => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ...company, invoiceName: company.invoiceName ?? "", gstin: company.gstin ?? "", pan: company.pan ?? "", address2: company.address2 ?? "" },
    mode: "onTouched",
  });
  const bar = useFormSaveBar(
    form,
    async (raw) => {
      const v = schema.parse(raw);
      onSaved(await updateCompany({ ...v, gstin: v.gstin || undefined, pan: v.pan || undefined }));
    },
    "Saved. New receipts and invoices use it straight away."
  );
  const registered = !!(useWatch({ control: form.control, name: "gstin" }) ?? "").toString().trim();
  const optional = registered ? "" : " (optional)";
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
        data-coach="company-form"
        onSubmit={(e) => {
          e.preventDefault();
          bar.save();
        }}
      >
        <SettingsSection title="Company and invoices" description="Who buyers are buying from. You can sell without GST registration: only the invoice name is needed." saveBar={<SaveBar state={bar} />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {text("invoiceName", "Name on receipts and invoices", { span: true, auto: "organization", max: 120, desc: "Buyers see it at checkout (\u201cSold by\u201d) and on the receipt and invoice we email them. Your store name, your own name or your business name all work." })}
            <h3 className="mt-2 font-sans text-sm font-semibold tracking-normal sm:col-span-2">GST and registered details <span className="font-normal text-muted-foreground">(only if you&apos;re registered)</span></h3>
            <p className="-mt-3 text-sm text-muted-foreground sm:col-span-2">With a GSTIN, invoices become tax invoices with GST worked out. Without one, they say no GST was charged.</p>
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
            {text("gstin", "GSTIN (optional)", { mono: true, max: 15, desc: "15 characters. We'll look up your registered details." })}
            {text("pan", "PAN (optional)", { mono: true, max: 10, desc: "Needed for TDS and payouts above ₹50,000 a year." })}
            <GstinLookup form={form} />
            {text("legalName", `Legal name${optional}`, { span: true, auto: "organization", desc: "Exactly as registered. Printed on tax invoices." })}
            {text("address1", `Address${optional}`, { span: true, auto: "address-line1" })}
            {text("address2", "Address line 2 (optional)", { span: true, auto: "address-line2" })}
            {text("city", `City${optional}`, { auto: "address-level2" })}
            <FormField control={form.control} name="state" render={({ field }) => (
              <FormItem>
                <FormLabel>State{optional}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                  <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {text("pincode", `PIN code${optional}`, { mono: true, max: 6, auto: "postal-code" })}
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
