"use client";

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
import { useCurrentStore } from "@/hooks/use-current-store";
import { ErrorState } from "@/components/pp/empty-state";
import { useApi } from "@/hooks/use-api";
import { changePassword, emailUsesGoogle, getEmailPrefs, saveEmailPrefs, updateStore, type EmailPrefs } from "@/lib/api";
import { sb } from "@/lib/supabase/browser";
import { can } from "@/lib/team";
import type { Store } from "@/lib/types";

const schema = z.object({
  ownerName: z.string().trim().min(2, "Enter your name."),
  ownerEmail: z.string().email("That email looks off. Check for typos."),
});

const pwSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: z.string().min(8, "Use at least 8 characters."), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The new passwords don't match." });
/** A Google account without a password yet: no current password to ask for */
const firstPwSchema = z
  .object({ current: z.string().optional(), next: z.string().min(8, "Use at least 8 characters."), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

/** Whether the signed-in account signs in with Google and has no password yet */
async function googleOnly(): Promise<boolean> {
  const { data } = await sb().auth.getUser();
  return emailUsesGoogle(data.user?.email ?? "");
}

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
  const methods = useApi(googleOnly, []);
  // Google accounts add their first password here (it links email and password to the same account).
  // Keyed, so the form starts over with the right fields once that's known.
  const first = methods.data === true;
  return <PasswordFields key={String(first)} first={first} onAdded={() => methods.setData(false)} />;
}

function PasswordFields({ first, onAdded }: { first: boolean; onAdded: () => void }) {
  const form = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver((first ? firstPwSchema : pwSchema) as typeof pwSchema), defaultValues: { current: "", next: "", confirm: "" }, mode: "onTouched" });
  const bar = useFormSaveBar(
    form,
    async (v) => {
      await changePassword(v.next, first ? undefined : v.current);
      // Passwords are never kept as the "saved" value: clear the fields after changing it
      setTimeout(() => form.reset({ current: "", next: "", confirm: "" }), 0);
      if (first) onAdded();
    },
    first ? "Password added. Log in with Google or with your email." : "Password changed.",
    { autosave: false }
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
        <SettingsSection title="Password" description={first ? "You log in with Google. Add a password to log in with your email too; Google keeps working." : undefined} saveBar={<SaveBar state={bar} label="New password not saved" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(first ? (["next", "confirm"] as const) : (["current", "next", "confirm"] as const)).map((n) => (
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
  ["newOrder", "Every order", "An email the moment someone pays or places a cash-on-delivery order."],
  ["payouts", "Payouts", "When money leaves for your bank, and if it comes back."],
] as const;

/**
 * What PowerProof emails you (saved on your account), and whether the store emails buyers who
 * left checkout. The bell always shows everything for the parts of the store you work on.
 */
function NotificationSettings({ store, onSaved }: { store: Store; onSaved: (s: Store) => void }) {
  const prefs = useApi(getEmailPrefs, []);
  const set = async (k: keyof EmailPrefs, v: boolean, label: string) => {
    if (!prefs.data) return;
    const next = { ...prefs.data, [k]: v };
    prefs.setData(next);
    try {
      await saveEmailPrefs(next);
      toast.success(v ? `${label}: on` : `${label}: off`);
    } catch (e) {
      prefs.setData({ ...next, [k]: !v });
      toast.error("Couldn't save that", { description: e instanceof Error ? e.message : undefined });
    }
  };
  const setReminders = async (v: boolean) => {
    try {
      onSaved(await updateStore({ cartReminders: v }));
      toast.success(v ? "Checkout reminders: on" : "Checkout reminders: off");
    } catch (e) {
      toast.error("Couldn't save that", { description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <SettingsSection title="Notifications" description="The bell at the top always shows new orders, refunds, disputes, reviews, questions, sign-ups, payouts and low stock. Choose which of them also come by email.">
      <div id="notifications" className="scroll-mt-24" />
      {prefs.error ? (
        <ErrorState message={prefs.error} onRetry={prefs.reload} />
      ) : (
        <ul className="divide-y">
          {PREFS.map(([k, label, body]) => (
            <li key={k}>
              <label className="flex min-h-14 items-center justify-between gap-4 py-2">
                <span><span className="block font-medium">{label}</span><span className="block text-sm text-muted-foreground">{body}</span></span>
                <Switch checked={prefs.data?.[k] ?? true} disabled={!prefs.data} onCheckedChange={(v) => set(k, v, label)} aria-label={label} />
              </label>
            </li>
          ))}
          {can(store.access, "marketing") && (
            <li>
              <label className="flex min-h-14 items-center justify-between gap-4 py-2">
                <span>
                  <span className="block font-medium">Remind buyers who didn&apos;t finish checkout</span>
                  <span className="block text-sm text-muted-foreground">One email, about an hour after someone starts paying and stops, with a link back to what they picked. For {store.name}.</span>
                </span>
                <Switch checked={store.cartReminders} onCheckedChange={setReminders} aria-label="Remind buyers who didn't finish checkout" />
              </label>
            </li>
          )}
        </ul>
      )}
    </SettingsSection>
  );
}

export default function ProfileSettingsPage() {
  const { data, error, reload, setData } = useCurrentStore();
  if (!data) return <SettingsLoading error={error} onRetry={reload} />;
  return (
    <div className="flex flex-col gap-6">
      <ProfileForm store={data} onSaved={setData} />
      <PasswordForm />
      <NotificationSettings store={data} onSaved={setData} />
    </div>
  );
}
