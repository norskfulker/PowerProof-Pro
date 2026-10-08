"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/auth/auth-card";
import { SaveBar } from "@/components/save/save-bar";
import { useFormSaveBar } from "@/hooks/use-dirty-form";
import { addBankAccount } from "@/lib/api";
import { holderNameMatches, IFSC_RE } from "@/lib/india";
import type { PayoutMethod } from "@/lib/types";

export const bankSchema = z
  .object({
    holderName: z.string().trim().min(2, "Enter the name exactly as your bank has it."),
    accountNumber: z.string().regex(/^\d{9,18}$/, "Account numbers are 9 to 18 digits."),
    confirm: z.string(),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(IFSC_RE, "IFSC codes look like HDFC0001234. It's on your cheque book."),
  })
  .refine((v) => v.accountNumber === v.confirm, { path: ["confirm"], message: "The account numbers don't match." });

/**
 * Shared by onboarding and the payouts page. Renders a <form id={formId}> so the caller owns the
 * buttons, or, with `saveBar`, shows the standard save bar once something has been typed.
 */
export function BankForm({
  formId,
  defaultName = "",
  allowedNames,
  onSaved,
  onPendingChange,
  saveBar,
}: {
  formId: string;
  defaultName?: string;
  /** The company's legal name and the director's name: the account must be in one of them */
  allowedNames?: (string | undefined)[];
  onSaved: (m: PayoutMethod) => void;
  onPendingChange?: (pending: boolean) => void;
  saveBar?: boolean;
}) {
  const [error, setError] = useState<string>();
  const namesKey = (allowedNames ?? []).filter((n): n is string => !!n?.trim()).join("|");
  const names = namesKey ? namesKey.split("|") : [];
  const schema = useMemo(
    () => bankSchema.superRefine((v, ctx) => {
      const allowed = namesKey ? namesKey.split("|") : [];
      if (allowed.length && !holderNameMatches(v.holderName, allowed)) ctx.addIssue({ code: "custom", path: ["holderName"], message: `The account must be in your company's name or the director's name (${allowed.join(" or ")}).` });
    }),
    [namesKey]
  );
  const form = useForm<z.infer<typeof bankSchema>>({
    resolver: zodResolver(schema),
    defaultValues: { holderName: defaultName, accountNumber: "", confirm: "", ifsc: "" },
    mode: "onTouched",
  });
  const bar = useFormSaveBar(
    form,
    async (raw) => {
      const v = schema.parse(raw);
      onSaved(await addBankAccount({ holderName: v.holderName, accountNumber: v.accountNumber, ifsc: v.ifsc }));
    },
    "Bank account verified",
    { autosave: false }
  );

  return (
    <Form {...form}>
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={saveBar ? (e) => { e.preventDefault(); bar.save(); } : form.handleSubmit(async (v) => {
          setError(undefined);
          onPendingChange?.(true);
          try {
            onSaved(await addBankAccount({ holderName: v.holderName, accountNumber: v.accountNumber, ifsc: v.ifsc }));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          } finally {
            onPendingChange?.(false);
          }
        })}
      >
        <FormError message={error} />
        <FormField
          control={form.control}
          name="holderName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account holder name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              {names.length > 0 && <FormDescription>In the name of your company or its director: {names.join(" or ")}.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="accountNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account number</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" className="font-mono" {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type it again</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    onPaste={(e) => e.preventDefault()}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="ifsc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IFSC</FormLabel>
              <FormControl>
                <Input className="font-mono uppercase" maxLength={11} autoCapitalize="characters" {...field} />
              </FormControl>
              <FormDescription>11 characters, like HDFC0001234. It&apos;s printed on your cheque book and in your banking app.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          We send ₹1 to check the account. Your details are encrypted and only used for payouts.
        </p>
        {saveBar && <SaveBar state={bar} label="Bank account not saved yet" bottomOffset="none" className="max-md:sticky max-md:bottom-0" />}
      </form>
    </Form>
  );
}
