"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm({
  heading,
  body,
  onSubscribe,
}: {
  heading: string;
  body: string;
  onSubscribe: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string>();

  return (
    <section aria-labelledby="nl-h" className="rounded-dialog bg-primary px-6 py-10 text-primary-foreground md:px-12">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
        <div>
          <h2 id="nl-h" className="text-3xl">{heading}</h2>
          <p className="mt-2 text-primary-foreground">{body}</p>
        </div>
        {state === "done" ? (
          <p className="flex items-center gap-2 font-semibold" role="status"><Check className="size-5" aria-hidden /> You&apos;re on the list.</p>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email)) return setError("That email looks off. Check for typos.");
              setState("pending");
              try {
                await onSubscribe(email);
                setState("done");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't subscribe.");
                setState("idle");
              }
            }}
          >
            <label htmlFor="nl-email" className="sr-only">Email</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="nl-email" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(undefined); }} aria-invalid={!!error || undefined} aria-describedby="nl-err" className="text-foreground" />
              <Button type="submit" variant="brass" disabled={state === "pending"}>
                {state === "pending" && <Loader2 className="animate-spin" aria-hidden />} Subscribe
              </Button>
            </div>
            {error && <p id="nl-err" role="alert" className="text-sm font-medium text-primary-foreground">{error}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
