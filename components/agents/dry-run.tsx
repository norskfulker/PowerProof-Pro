"use client";

import { useState } from "react";
import { Eye, Mail, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agentOp, type DryRunResult } from "@/lib/api/agents";

const OUTCOME: Record<string, string> = {
  would_send: "Would go out now",
  outside_window: "Would wait for your sending hours",
  frequency_cap: "Would wait: messaged recently",
  daily_cap: "Would wait: today's limit reached",
  channel_off: "Channel switched off",
  invalid_recipient: "No contact for this channel",
};

/** The free dry run: exactly what the agent would do now. Nothing is sent and no credits are used. */
export function DryRun({ instanceId, onResult }: { instanceId: string; onResult?: (r: DryRunResult) => void }) {
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const preview = (result?.output.preview as { customer: string; channel: string; subject: string | null; body: string; outcome: string }[] | undefined) ?? [];

  async function run() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await agentOp<DryRunResult>(instanceId, { op: "dry_run" });
      setResult(r);
      onResult?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The preview didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button size="lg" variant={result ? "secondary" : "primary"} onClick={run} disabled={busy}>
        <Eye aria-hidden /> {busy ? "Working it out…" : result ? "Run the preview again" : "Show me what it would send"}
      </Button>
      <p className="text-sm text-muted-foreground">Free. Nothing is sent and no credits are used.</p>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {result && (
        <div className="flex flex-col gap-3" role="status">
          <p className="font-semibold">
            {preview.length ? `${preview.length} ${preview.length === 1 ? "message" : "messages"} right now` : "Nothing to send right now."}
            {result.actions.some((a) => a.kind === "needs_personal_call") ? ` · ${result.actions.filter((a) => a.kind === "needs_personal_call").length} to call yourself` : ""}
          </p>
          <ul className="flex flex-col gap-3">
            {preview.map((p, i) => (
              <li key={i} className="rounded-card border bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {p.channel === "email" ? <Mail className="size-4" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
                  {p.customer} · {p.channel === "email" ? "Email" : "WhatsApp (you tap send)"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{OUTCOME[p.outcome] ?? p.outcome}</p>
                {p.subject && <p className="mt-3 text-sm font-semibold">{p.subject}</p>}
                <p className="mt-2 text-sm whitespace-pre-wrap">{p.body}</p>
              </li>
            ))}
            {result.actions
              .filter((a) => a.kind === "needs_personal_call")
              .map((a, i) => (
                <li key={`call-${i}`} className="flex items-start gap-2 rounded-card border bg-surface p-4 text-sm">
                  <PhoneCall className="mt-0.5 size-4" aria-hidden /> <span><strong>{a.title}</strong> {a.body}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
