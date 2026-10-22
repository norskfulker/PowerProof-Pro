"use client";

import { useState } from "react";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendPasswordLink, signInWithGoogle } from "@/lib/api";
import { AuthCard, FormError } from "./auth-card";
import { GoogleMark } from "./google-button";

/**
 * The email someone typed already belongs to an account that signs in with Google. They can
 * continue with Google, or add a password to that same account: a link to the inbox proves the
 * email is theirs, then they choose the password (both ways keep working afterwards).
 */
export function GoogleAccountNotice({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const [busy, setBusy] = useState<"google" | "link">();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  if (sent) {
    return (
      <AuthCard title="Check your inbox" description={<>We sent a link to <strong className="text-foreground">{email}</strong>. Open it to choose a password for your account.</>}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-card bg-primary-soft p-4 text-sm">
            <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
            Your Google login keeps working too. Can&apos;t find the email? Look in Promotions or Spam.
          </div>
          <Button variant="ghost" onClick={onBack}>Back to log in</Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="This email uses Google" description={<><strong className="text-foreground">{email}</strong> already has a PowerProof account that signs in with Google. Continue with Google, or add a password to the same account.</>}>
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!!busy}
          onClick={async () => {
            setBusy("google");
            setError(undefined);
            try {
              await signInWithGoogle(next);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
              setBusy(undefined);
            }
          }}
        >
          {busy === "google" ? <Loader2 className="animate-spin" aria-hidden /> : <GoogleMark />}
          Continue with Google
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!!busy}
          onClick={async () => {
            setBusy("link");
            setError(undefined);
            try {
              await sendPasswordLink(email);
              setSent(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setBusy(undefined);
            }
          }}
        >
          {busy === "link" ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
          Add a password to this account
        </Button>
        <p className="text-center text-xs text-muted-foreground">We&apos;ll email a link to {email} to make sure it&apos;s yours.</p>
        <Button type="button" variant="ghost" onClick={onBack}>Use a different email</Button>
      </div>
    </AuthCard>
  );
}
