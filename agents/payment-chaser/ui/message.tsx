"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Flag } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { chaserOp, currentStoreId, getReminder, reportProblem, type AgentInstance } from "@/lib/api/agents";
import { REMINDER_LABEL } from "./customers";
import { day } from "./shared";

/** One reminder: exactly what the customer gets. Waiting ones can be edited; any can be reported. */
export function MessageView({ instance, path }: { instance: AgentInstance; path: string[] }) {
  const id = path[1] ?? "";
  const { data: r, loading, error, reload } = useApi(() => getReminder(id), [id], { live: true });
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !r) return <Skeleton className="h-64 rounded-card" />;
  const editable = r.status === "drafted" || r.status === "approved" || r.status === "snoozed";
  const dirty = (subject !== null && subject !== (r.subject ?? "")) || (body !== null && body !== r.body);
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <Link href={`/agents/my/${instance.id}/customers/${r.customerId}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Customer
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl">Reminder {r.stage}</h2>
        <StatusPill status={r.status} label={REMINDER_LABEL[r.status]} />
      </div>
      <p className="text-sm text-muted-foreground">
        {r.channel === "email" ? "Email" : "WhatsApp"} · {r.language === "hinglish" ? "Hinglish" : "English"} · {r.tone}
        {r.sentAt ? ` · sent ${day(r.sentAt.slice(0, 10))}` : ""}
        {r.source === "fallback" ? " · standard wording" : r.source === "owner" ? " · your wording" : " · written with AI, facts filled by the app"}
      </p>
      {r.status === "snoozed" && r.error && <p className="rounded-control border border-warning/40 bg-warning-soft/40 p-3 text-sm">{r.error}</p>}
      {editable ? (
        <div className="flex flex-col gap-4">
          {r.channel === "email" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-subject">Subject</Label>
              <Input id="m-subject" maxLength={150} value={subject ?? r.subject ?? ""} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-body">Message</Label>
            <Textarea id="m-body" rows={10} value={body ?? r.body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {r.channel === "email" ? "An unsubscribe link is added below it." : "“Reply STOP to opt out.” is added below it."} Threats or legal-sounding words aren&apos;t allowed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <Button disabled={busy} onClick={() => act(() => chaserOp({ op: "edit_reminder", reminderId: r.id, subject: subject ?? r.subject, body: body ?? r.body }), "Saved. This is what will go out.").then(() => (setSubject(null), setBody(null)))}>
                Save changes
              </Button>
            )}
            {r.status === "snoozed" && !dirty && (
              <Button disabled={busy} onClick={() => act(() => chaserOp({ op: "approve_reminder", reminderId: r.id }), "Approved. It goes out on the next run.")}>
                Approve and send
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-card border bg-surface p-4">
          {r.subject && <p className="mb-2 font-semibold">{r.subject}</p>}
          <p className="text-sm whitespace-pre-wrap">{r.body}</p>
          {r.error && r.status !== "sent" && <p className="mt-3 text-sm text-muted-foreground">Why: {r.error}</p>}
        </div>
      )}
      <div className="border-t pt-4">
        {reporting ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-report">What&apos;s wrong with it?</Label>
            <Textarea id="m-report" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button
                disabled={busy || !note.trim()}
                onClick={() =>
                  act(async () => {
                    await reportProblem({ storeId: await currentStoreId(), instanceId: instance.id, kind: "wrong_message", message: note.trim(), context: { reminderId: r.id, stage: r.stage, channel: r.channel, status: r.status, subject: r.subject, body: r.body } });
                    setReporting(false);
                    setNote("");
                  }, "Thanks. PowerProof will look at it.")
                }
              >
                Send report
              </Button>
              <Button variant="ghost" onClick={() => setReporting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setReporting(true)}>
            <Flag aria-hidden /> Report a wrong message
          </Button>
        )}
      </div>
    </div>
  );
}
