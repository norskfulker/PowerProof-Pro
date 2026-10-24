"use client";

import Link from "next/link";
import { ArrowRight, FileUp, MessageCircle, Users } from "lucide-react";
import { ExplainedNumber } from "@/components/agents/bits";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getActionItems, getMetrics, type AgentInstance } from "@/lib/api/agents";
import manifest from "../manifest";
import { AgingBar, inr, useChaser } from "./shared";

/** Payment Chaser's home: three big numbers, where the money sits, and what needs you */
export function ChaserOverview({ instance }: { instance: AgentInstance }) {
  const { derived, loading, error, reload } = useChaser();
  const metrics = useApi(() => getMetrics(instance.id), [instance.id], { live: true });
  const queue = useApi(() => getActionItems({ instanceId: instance.id }), [instance.id], { live: true });
  const base = `/agents/my/${instance.id}`;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !derived) return <Skeleton className="h-64 rounded-card" />;
  if (!derived.invoices.length)
    return (
      <EmptyState
        icon={FileUp}
        title="No invoices yet"
        body="Upload your invoice file, connect a Google Sheet, or add one by hand. Then Payment Chaser knows who to remind."
        action={
          <Button asChild>
            <Link href={`${base}/upload`}>Add invoices</Link>
          </Button>
        }
      />
    );

  const label = (k: string) => manifest.metrics.find((m) => m.key === k)!;
  const m = metrics.data;
  const waiting = (queue.data ?? []).filter((a) => a.kind === "whatsapp_send").length;
  const calls = (queue.data ?? []).filter((a) => a.kind === "needs_personal_call").length;
  return (
    <div className="flex flex-col gap-5">
      {waiting > 0 && (
        <Link href="/agents/my/queue" className="flex min-h-14 items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary-soft px-4 py-3">
          <span className="flex items-center gap-3 font-semibold">
            <MessageCircle className="size-5" aria-hidden /> {waiting} WhatsApp {waiting === 1 ? "message" : "messages"} ready to send
          </span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ExplainedNumber label={label("overdue_total").label} value={inr(m?.overdue_total ?? derived.due.minor)} explain={label("overdue_total").explain} emphasis />
        <ExplainedNumber label={label("paid_after_reminder_month").label} value={m ? inr(m.paid_after_reminder_month ?? 0) : "…"} loading={metrics.loading} explain={label("paid_after_reminder_month").explain} />
        <ExplainedNumber label={label("reminders_sent").label} value={m ? String(m.reminders_sent ?? 0) : "…"} loading={metrics.loading} explain={label("reminders_sent").explain} />
      </div>
      <section className="rounded-card border bg-surface p-5" aria-labelledby="aging">
        <h2 id="aging" className="text-base font-semibold">
          How late: {derived.due.count} overdue {derived.due.count === 1 ? "invoice" : "invoices"}
        </h2>
        <div className="mt-4">
          <AgingBar buckets={derived.due.buckets} />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink href={`${base}/customers`} icon={Users} title="Customers" body={`${derived.customers.filter((c) => c.overdueMinor > 0).length} owe you money`} />
        <QuickLink href={`${base}/invoices`} icon={FileUp} title="Invoices" body={`${derived.invoices.filter((i) => i.status === "open").length} open`} />
        <QuickLink href="/agents/my/queue" icon={MessageCircle} title="Send queue" body={calls ? `${waiting} to send, ${calls} to call` : `${waiting} to send`} />
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, body }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-card border bg-surface p-4 transition-colors hover:border-primary/40">
      <Icon className="size-5 text-muted-foreground" />
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{body}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** The free preview's numbers, before any message is sent */
export function ChaserPreviewSummary() {
  const { derived, loading } = useChaser();
  if (loading || !derived) return <Skeleton className="h-40 rounded-card" />;
  const owing = derived.customers.filter((c) => c.overdueMinor > 0).sort((a, b) => b.overdueMinor - a.overdueMinor);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <ExplainedNumber label="Total overdue" value={inr(derived.due.minor)} explain="Every unpaid invoice past its due date, minus what was already paid on it." emphasis />
        <ExplainedNumber label="Overdue invoices" value={String(derived.due.count)} explain="Open invoices whose due date has passed." />
      </div>
      <div className="rounded-card border bg-surface p-4">
        <AgingBar buckets={derived.due.buckets} />
      </div>
      {owing.length > 0 && (
        <div className="rounded-card border bg-surface p-4">
          <p className="text-sm font-semibold">{owing.length} customers owe you money</p>
          <ul className="mt-2 flex flex-col divide-y text-sm">
            {owing.slice(0, 8).map((c) => (
              <li key={c.customer.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{c.customer.name}</span>
                <span className="font-semibold tabular">{inr(c.overdueMinor)}</span>
              </li>
            ))}
          </ul>
          {owing.length > 8 && <p className="mt-1 text-sm text-muted-foreground">and {owing.length - 8} more</p>}
        </div>
      )}
    </div>
  );
}
