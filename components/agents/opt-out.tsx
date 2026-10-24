"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmOptOut } from "@/lib/api/agents";

/** One tap stops reminders from this business on this channel (a page, not a GET, so link scanners can't trigger it) */
export function OptOut({ token }: { token: string }) {
  const [state, setState] = useState<"ask" | "busy" | "done">("ask");
  const [error, setError] = useState<string>();
  if (state === "done")
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 pt-16 text-center" role="status">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h1 className="text-2xl">You won&apos;t get these reminders again.</h1>
        <p className="text-muted-foreground">If you still owe the business money, you can reach them directly.</p>
      </div>
    );
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pt-16">
      <h1 className="text-3xl">Stop payment reminders?</h1>
      <p className="text-muted-foreground">You&apos;ll get no more reminders from this business through this channel.</p>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button
        size="lg"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          setError(undefined);
          try {
            await confirmOptOut(token);
            setState("done");
          } catch (e) {
            setError(e instanceof Error ? e.message : "That didn't work. Try again.");
            setState("ask");
          }
        }}
      >
        {state === "busy" ? "Stopping…" : "Stop reminders"}
      </Button>
    </div>
  );
}
