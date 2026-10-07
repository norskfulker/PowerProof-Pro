"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { GoogleSignIn } from "@/components/auth/google-button";
import { signup } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you."),
  email: z.string().min(1, "Enter your email.").email("That email looks off. Check for typos."),
  password: z.string().min(8, "Use at least 8 characters. A short sentence works well."),
});

type Values = z.infer<typeof schema>;

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const template = params.get("template");
  const [error, setError] = useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" }, mode: "onTouched" });

  async function onSubmit(v: Values) {
    setError(undefined);
    try {
      const session = await signup(v.name, v.email, v.password);
      // Signed straight in (email confirmation off in this project): no code to enter
      if (!session.needsVerification) {
        router.push(template ? `/onboarding?template=${template}` : "/onboarding");
        return;
      }
      const q = new URLSearchParams({ email: v.email });
      if (template) q.set("template", template);
      router.push(`/verify-email?${q}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const pending = form.formState.isSubmitting;
  const pw = useWatch({ control: form.control, name: "password" });

  return (
    <AuthCard
      title="Start your free month"
      description="No card needed. You'll have a store in about three minutes."
      footer={<>Already selling? <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">Log in</Link></>}
    >
      <GoogleSignIn next={template ? `/onboarding?template=${template}` : "/onboarding"} onError={setError} />
      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormError message={error} />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription className="flex items-center gap-1.5">
                  {pw.length >= 8 && <Check className="size-3.5 text-success" aria-hidden />}
                  8 or more characters
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" disabled={pending} className="mt-2">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Create my store
          </Button>
          <p className="text-center text-xs text-muted-foreground">First month free, then $20/month and 3% per sale.</p>
        </form>
      </Form>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
