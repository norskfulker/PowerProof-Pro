"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentStore } from "@/hooks/use-current-store";
import { reportProblem } from "@/lib/api/agents";

/**
 * "Post agent": send PowerProof an agent to list in the marketplace (yours, or one you want built).
 * It lands in the agents support inbox, where the team reviews it before it goes live.
 */
export function PostAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: store } = useCurrentStore();
  const [name, setName] = useState("");
  const [does, setDoes] = useState("");
  const [link, setLink] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string>();
  const [shown, setShown] = useState(false);
  // Fresh fields each time it opens
  if (open !== shown) {
    setShown(open);
    if (open) {
      setName("");
      setDoes("");
      setLink("");
      setState("idle");
      setError(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => state !== "sending" && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Post an agent</DialogTitle>
          <DialogDescription>Tell us what it does. We review every agent before it&apos;s listed, and email you when it&apos;s live.</DialogDescription>
        </DialogHeader>
        {state === "done" ? (
          <div className="flex items-start gap-3 rounded-card border bg-surface p-4" role="status">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <p className="text-sm">
              <span className="block font-semibold">Sent for review.</span>
              We&apos;ll reply to {store?.ownerEmail ?? "your email"} within two working days.
            </p>
          </div>
        ) : (
          <form
            id="post-agent"
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!store) return;
              setError(undefined);
              setState("sending");
              try {
                await reportProblem({
                  storeId: store.id,
                  kind: "other",
                  message: `Agent submission: ${name.trim()}\n\n${does.trim()}${link.trim() ? `\n\nLink: ${link.trim()}` : ""}`,
                  context: { type: "agent_submission", name: name.trim(), link: link.trim() || null },
                });
                setState("done");
              } catch (err) {
                setError(err instanceof Error ? err.message : "That didn't go through. Try again.");
                setState("idle");
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pa-name">Agent name</Label>
              <Input id="pa-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Invoice follow-up" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pa-does">What it does</Label>
              <Textarea id="pa-does" required minLength={10} maxLength={1500} rows={4} value={does} onChange={(e) => setDoes(e.target.value)} placeholder="Who it's for, what it reads, what it sends and how often" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pa-link">Link (optional)</Label>
              <Input id="pa-link" type="url" inputMode="url" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
            </div>
            {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
          </form>
        )}
        <DialogFooter>
          {state === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={state === "sending"}>Cancel</Button>
              <Button type="submit" form="post-agent" disabled={state === "sending" || !store}>
                {state === "sending" && <Loader2 className="animate-spin" aria-hidden />} Send for review
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
