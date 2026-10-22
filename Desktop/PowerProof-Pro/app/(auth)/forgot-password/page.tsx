"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { requestPasswordReset } from "@/lib/api";

const schema = z.object({ email: z.string().min(1, "Enter your email.").email("That email looks off. Check for typos.") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string>();
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" }, mode: "onTouched" });

  if (sent) {
    return (
      <AuthCard
        title="Reset link sent"
        description={<>If <strong className="text-foreground">{sent}</strong> has an account, a reset link is on its way. It works for 30 minutes.</>}
        footer={<Link href="/login" className="font-semibold text-foreground underline underline-offset-4">Back to log in</Link>}
      >
        <div className="flex items-center gap-3 rounded-card bg-primary-soft p-4 text-sm">
          <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
          Nothing after five minutes? Check Spam, or try the email you signed up with.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="It happens. We'll email you a link to set a new one."
      footer={<>Remembered it? <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">Log in</Link></>}
    >
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(async ({ email }) => {
            setError(undefined);
            try {
              await requestPasswordReset(email);
              setSent(email);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })}
          className="flex flex-col gap-4"
        >
          <FormError message={error} />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" inputMode="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Send reset link
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
