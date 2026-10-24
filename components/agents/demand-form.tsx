"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestAgent } from "@/lib/api/agents";

/** "I need this" on a coming-soon agent: saved for PowerProof's demand board */
export function DemandForm({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string>();

  if (state === "done")
    return (
      <div className="flex items-start gap-3 rounded-card border bg-surface p-5" role="status">
        <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden />
        <div>
          <p className="font-semibold">Thanks, we&apos;ve noted it.</p>
          <p className="text-sm text-muted-foreground">We&apos;ll email you when {agentName} is ready. The more people ask, the sooner it comes.</p>
        </div>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4 rounded-card border bg-surface p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(undefined);
        setState("sending");
        try {
          const m = mobile.replace(/[\s-]/g, "");
          await requestAgent({ agentId, email: email.trim(), mobile: m ? (m.startsWith("+") ? m : `+91${m.replace(/^0/, "")}`) : undefined, note: note.trim() || undefined });
          setState("done");
        } catch (err) {
          setError(err instanceof Error ? err.message : "That didn't go through. Try again.");
          setState("idle");
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="demand-email">Your email</Label>
        <Input id="demand-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="demand-mobile">Mobile (optional)</Label>
        <Input id="demand-mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="demand-note">What would you use it for? (optional)</Label>
        <Textarea id="demand-note" maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={state === "sending"}>
        {state === "sending" ? "Saving…" : "I need this"}
      </Button>
    </form>
  );
}
