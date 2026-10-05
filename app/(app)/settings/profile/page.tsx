"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SaveBar } from "@/components/save/save-bar";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useFormSaveBar } from "@/hooks/use-dirty-form";
import { useApi } from "@/hooks/use-api";
import { getStore, updateStore } from "@/lib/api";
import type { Store } from "@/lib/types";

const schema = z.object({
  ownerName: z.string().trim().min(2, "Enter your name."),
  ownerEmail: z.string().email("That email looks off. Check for typos."),
});

const pwSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: z.string().min(8, "Use at least 8 characters."), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The new passwords don't match." });

function ProfileForm({ store, onSaved }: { store: Store; onSaved: (s: Store) => void }) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { ownerName: store.ownerName, ownerEmail: store.ownerEmail }, mode: "onTouched" });
  const bar = useFormSaveBar(form, async (v) => onSaved(await updateStore(v)), "Profile saved");
  return (
    <Form {...form}>
      <form
        id="profile"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          bar.save();
        }}
      >
        <SettingsSection title="Profile" description="How we address you and where we send account emails." saveBar={<SaveBar state={bar} />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="ownerName" render={({ field }) => (
              <FormItem><FormLabel>Your name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="ownerEmail" render={({ field }) => (
              <FormItem><FormLabel>Login email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormDescription>We&apos;ll confirm a new address before switching.</FormDescription><FormMessage /></FormItem>
            )} />
          </div>
        </SettingsSection>
      </form>
    </Form>
  );
}

function PasswordForm() {
  const form = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema), defaultValues: { current: "", next: "", confirm: "" }, mode: "onTouched" });
  const bar = useFormSaveBar(
    form,
    async () => {
      await new Promise((r) => setTimeout(r, 500));
      // Passwords are never kept as the "saved" value: clear the fields after changing it
      setTimeout(() => form.reset({ current: "", next: "", confirm: "" }), 0);
    },
    "Password changed. Other devices have been logged out."
  );
  return (
    <Form {...form}>
      <form
        id="password"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          bar.save();
        }}
      >
        <SettingsSection title="Password" saveBar={<SaveBar state={bar} label="New password not saved" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["current", "next", "confirm"] as const).map((n) => (
              <FormField key={n} control={form.control} name={n} render={({ field }) => (
                <FormItem>
                  <FormLabel>{n === "current" ? "Current" : n === "next" ? "New" : "New, again"}</FormLabel>
                  <FormControl><Input type="password" autoComplete={n === "current" ? "current-password" : "new-password"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
          </div>
        </SettingsSection>
      </form>
    </Form>
  );
}

const PREFS = [
  ["sale", "Every sale", "An email the moment someone buys."],
  ["payout", "Payouts", "When money leaves for your bank, and when it lands."],
  ["refund", "Refund requests", "So you can reply quickly."],
  ["weekly", "Monday summary", "Last week's sales in one short email."],
] as const;

export default function ProfileSettingsPage() {
  const { data, error, reload, setData } = useApi(getStore, []);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ sale: true, payout: true, refund: true, weekly: false });
  if (!data) return <SettingsLoading error={error} onRetry={reload} />;
  return (
    <div className="flex flex-col gap-6">
      <ProfileForm store={data} onSaved={setData} />
      <PasswordForm />
      <SettingsSection title="Email me about" description="Saved as you switch.">
        <ul className="divide-y">
          {PREFS.map(([k, label, body]) => (
            <li key={k}>
              <label className="flex min-h-14 items-center justify-between gap-4 py-2">
                <span><span className="block font-medium">{label}</span><span className="block text-sm text-muted-foreground">{body}</span></span>
                <Switch checked={prefs[k]} onCheckedChange={(v) => { setPrefs({ ...prefs, [k]: v }); toast.success(v ? `${label}: on` : `${label}: off`); }} aria-label={label} />
              </label>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
