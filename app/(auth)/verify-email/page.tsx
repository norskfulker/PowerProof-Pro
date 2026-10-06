"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth/auth-card";
import { resendVerification, verifyEmail } from "@/lib/api";
import { isLive } from "@/lib/supabase/env";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "your email";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState(30);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter all 6 digits.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await verifyEmail(code, params.get("email") ?? undefined);
      toast.success("Email confirmed");
      const t = params.get("template");
      router.push(t ? `/onboarding?template=${t}` : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Check your email"
      description={<>We sent a 6-digit code to <strong className="text-foreground">{email}</strong>.</>}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4" data-coach="verify-code">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(undefined);
            }}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "code-error" : "code-help"}
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            placeholder="······"
          />
          {error ? (
            <p id="code-error" className="text-sm font-medium text-danger">{error}</p>
          ) : (
            <p id="code-help" className="text-sm text-muted-foreground">
              {isLive() ? "Or open the link in the same email." : "Demo: any 6 digits work. 000000 shows the expired message."}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Confirm email
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={wait > 0}
          onClick={async () => {
            setWait(30);
            try {
              await resendVerification(params.get("email") ?? "");
              toast.success("New code sent");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong.");
            }
          }}
        >
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
