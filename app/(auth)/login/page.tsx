"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { login, sendLoginLink } from "@/lib/api";

const passwordSchema = z.object({
  email: z.string().min(1, "Enter your email.").email("That email looks off. Check for typos."),
  password: z.string().min(1, "Enter your password."),
});
const linkSchema = z.object({ email: passwordSchema.shape.email, password: z.string().optional() });

type Values = z.infer<typeof passwordSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [error, setError] = useState<string>();
  const [linkSent, setLinkSent] = useState<string>();

  const form = useForm<Values>({
    resolver: zodResolver(mode === "password" ? passwordSchema : (linkSchema as unknown as typeof passwordSchema)),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  async function onSubmit(v: Values) {
    setError(undefined);
    try {
      if (mode === "link") {
        await sendLoginLink(v.email);
        setLinkSent(v.email);
        return;
      }
      await login(v.email, v.password);
      toast.success("Welcome back");
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (linkSent) {
    return (
      <AuthCard title="Check your inbox" description={<>We sent a login link to <strong className="text-foreground">{linkSent}</strong>. It works for 15 minutes.</>}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-card bg-primary-soft p-4 text-sm">
            <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
            Can&apos;t find it? Look in Promotions or Spam.
          </div>
          <Button asChild>
            <Link href="/emails/login-link">Open the demo email</Link>
          </Button>
          <Button variant="ghost" onClick={() => setLinkSent(undefined)}>Use a different email</Button>
        </div>
      </AuthCard>
    );
  }

  const pending = form.formState.isSubmitting;
  return (
    <AuthCard
      title="Log in"
      description="Good to see you again."
      footer={<>New here? <Link href="/signup" className="font-semibold text-foreground underline underline-offset-4">Start free</Link></>}
    >
      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          {mode === "password" && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                      Forgot it?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <Button type="submit" size="lg" disabled={pending} className="mt-2">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {mode === "password" ? "Log in" : "Email me a login link"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(undefined);
              form.clearErrors();
              setMode(mode === "password" ? "link" : "password");
            }}
          >
            {mode === "password" ? "Email me a login link instead" : "Use my password instead"}
          </Button>
          <p className="rounded-control bg-surface-sunken px-3.5 py-2.5 text-xs text-muted-foreground">
            Demo: any email with an 8+ character password opens the sample store.
          </p>
        </form>
      </Form>
    </AuthCard>
  );
}
