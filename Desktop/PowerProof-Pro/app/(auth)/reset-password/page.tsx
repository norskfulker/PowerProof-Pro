"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { updatePassword } from "@/lib/api";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters. A short sentence works well."),
    confirm: z.string().min(1, "Type it again to be sure."),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "These don't match." });

/** The reset link signs the creator in and lands here to choose a new password. */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}

/** ?bind=1: from "Add a password to this account" (an account that signs in with Google) */
function ResetPassword() {
  const bind = useSearchParams().get("bind") === "1";
  const router = useRouter();
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" }, mode: "onTouched" });

  return (
    <AuthCard title={bind ? "Choose a password" : "Choose a new password"} description={bind ? "Your email is now linked. Pick a password and you can log in with it or with Google, whichever is handy." : "You'll use it next time you log in."}>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(async ({ password }) => {
            setError(undefined);
            try {
              await updatePassword(password);
              toast.success(bind ? "Password added" : "Password updated", bind ? { description: "Log in with your email and password, or with Google." } : undefined);
              router.push("/dashboard");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })}
          className="flex flex-col gap-4"
        >
          <FormError message={error} />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Save password
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
