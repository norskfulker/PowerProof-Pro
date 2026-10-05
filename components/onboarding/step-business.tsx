"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/auth/auth-card";
import { updateCompany } from "@/lib/api";
import { BUSINESS_TYPES, GSTIN_RE, INDIAN_STATES } from "@/lib/india";
import type { Company } from "@/lib/types";
import { StepFrame } from "./step-frame";

const schema = z.object({
  businessType: z.enum(["individual", "proprietorship", "partnership", "llp", "private_limited"]),
  legalName: z.string().trim().min(2, "Enter the name that should appear on invoices."),
  gstin: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => s === "" || GSTIN_RE.test(s), "GSTINs are 15 characters, like 27ABCPR1234F1Z5."),
  state: z.string().min(1, "Pick your state. It decides which GST applies."),
});

type Values = z.input<typeof schema>;

export function StepBusiness({
  initial,
  onDone,
  onBack,
}: {
  initial: Partial<Company> & { ownerName: string };
  onDone: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string>();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessType: initial.businessType ?? "individual",
      legalName: initial.legalName || initial.ownerName,
      gstin: initial.gstin ?? "",
      state: initial.state ?? "",
    },
    mode: "onTouched",
  });

  return (
    <StepFrame
      formId="step-business"
      title="Business details"
      description="Optional. These go on your invoices. Skip and add them whenever you're ready."
      timeLeft="About 2½ minutes to go"
      onBack={onBack}
      onSkip={onDone}
      pending={form.formState.isSubmitting}
    >
      <Form {...form}>
        <form
          id="step-business"
          noValidate
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(async (raw) => {
            const v = schema.parse(raw);
            setError(undefined);
            try {
              await updateCompany({ businessType: v.businessType, legalName: v.legalName, gstin: v.gstin || undefined, state: v.state });
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })}
        >
          <FormError message={error} />
          <FormField
            control={form.control}
            name="businessType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What are you?</FormLabel>
                <FormControl>
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                    {BUSINESS_TYPES.map((t) => (
                      <label
                        key={t.value}
                        className="flex cursor-pointer gap-3 rounded-control border p-3.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft"
                      >
                        <RadioGroupItem value={t.value} className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-semibold">{t.label}</span>
                          <span className="block text-xs text-muted-foreground">{t.hint}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name on invoices</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="gstin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN (if you have one)</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono uppercase" maxLength={15} autoCapitalize="characters" />
                  </FormControl>
                  <FormDescription>Leave blank if you&apos;re not registered.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </StepFrame>
  );
}
