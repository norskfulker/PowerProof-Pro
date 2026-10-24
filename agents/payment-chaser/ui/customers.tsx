"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { daysSince } from "@/components/agents/bits";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { chaserOp, getReminders, type AgentInstance, type ChaserInvoice, type ChaserReminder } from "@/lib/api/agents";
import { day, inr, useChaser } from "./shared";

type Tab = "owing" | "all" | "paused";

const lastReminder = (rs: ChaserReminder[], customerId: string) => rs.find((r) => r.customerId === customerId && (r.status === "sent" || r.status === "queued"));

export function CustomersView({ instance, path }: { instance: AgentInstance; path: string[] }) {
  if (path[1]) return <CustomerDetail instance={instance} customerId={path[1]} />;
  return <CustomerList instance={instance} />;
}

function CustomerList({ instance }: { instance: AgentInstance }) {
  const { derived, loading, error, reload } = useChaser();
  const reminders = useApi(() => getReminders({ limit: 1000 }), [], { live: true });
  const [tab, setTab] = useState<Tab>("owing");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const all = derived?.customers ?? [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((c) => (tab === "owing" ? c.overdueMinor > 0 : tab === "paused" ? c.customer.isPaused || !!c.customer.optedOutAt : true))
      .filter((c) => words.every((w) => `${c.customer.name} ${c.customer.phone ?? ""} ${c.customer.email ?? ""}`.toLowerCase().includes(w)))
      .sort((a, b) => b.overdueMinor - a.overdueMinor || a.customer.name.localeCompare(b.customer.name));
  }, [derived, tab, q]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !derived) return <Skeleton className="h-64 rounded-card" />;
  const base = `/agents/my/${instance.id}/customers`;
  return (
    <div className="flex flex-col gap-4">
      <StatusTabs<Tab>
        label="Which customers"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "owing", label: "Owe you", count: derived.customers.filter((c) => c.overdueMinor > 0).length },
          { value: "all", label: "All", count: derived.customers.length },
          { value: "paused", label: "Paused or opted out", count: derived.customers.filter((c) => c.customer.isPaused || c.customer.optedOutAt).length },
        ]}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search customers" placeholder="Name, mobile or email" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length ? (
        <ul className="flex flex-col divide-y rounded-card border bg-surface">
          {list.map((c) => {
            const last = lastReminder(reminders.data ?? [], c.customer.id);
            return (
              <li key={c.customer.id}>
                <Link href={`${base}/${c.customer.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.customer.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.oldestDue ? `Oldest due ${day(c.oldestDue)} · ${daysSince(c.oldestDue)} days` : c.owedMinor ? "Not due yet" : "Nothing owed"}
                      {last ? ` · Last reminder ${day((last.sentAt ?? last.queuedAt ?? last.createdAt).slice(0, 10))}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular">{inr(c.overdueMinor || c.owedMinor)}</span>
                    {c.customer.optedOutAt ? <StatusPill status="opted_out" label="Opted out" tone="neutral" /> : c.customer.isPaused ? <StatusPill status="paused" /> : !c.customer.phone && !c.customer.email ? <StatusPill status="no_contact" label="Missing contact" tone="warning" /> : null}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Users} compact title={q ? "No customer matches that." : tab === "owing" ? "Nobody owes you anything overdue." : "No customers here."} body={tab === "owing" && !q ? "Nice. New overdue invoices show up here." : undefined} />
      )}
    </div>
  );
}

const INVOICE_STATUS: Record<ChaserInvoice["status"], string> = { open: "Open", paid: "Paid", paused: "Paused", disputed: "Disputed", written_off: "Written off" };

function CustomerDetail({ instance, customerId }: { instance: AgentInstance; customerId: string }) {
  const { derived, loading, error, reload } = useChaser();
  const reminders = useApi(() => getReminders({ customerId }), [customerId], { live: true });
  const [busy, setBusy] = useState(false);
  const c = derived?.customerById.get(customerId);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !derived) return <Skeleton className="h-64 rounded-card" />;
  if (!c) return <EmptyState title="That customer wasn't found." />;
  const invoices = derived.invoices.filter((i) => i.customerId === customerId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await chaserOp(body);
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };
  const back = `/agents/my/${instance.id}/customers`;
  return (
    <div className="flex flex-col gap-5">
      <Link href={back} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </Link>
      <h2 className="text-2xl">{c.name}</h2>

      <section className="flex flex-col gap-4 rounded-card border bg-surface p-4" aria-label="Contact">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-phone">Mobile (WhatsApp)</Label>
            <Input id="c-phone" type="tel" inputMode="tel" value={phone ?? c.phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" inputMode="email" value={email ?? c.email ?? ""} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        {(phone !== null || email !== null) && (
          <Button disabled={busy} className="self-start" onClick={() => run({ op: "update_customer", customerId, ...(phone !== null ? { phone: phone || null } : {}), ...(email !== null ? { email: email || null } : {}) }, "Saved.").then(() => (setPhone(null), setEmail(null)))}>
            Save contact
          </Button>
        )}
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Pause reminders</span>
            <span className="block text-sm text-muted-foreground">Nothing goes to {c.name} until you switch this off.</span>
          </span>
          <Switch checked={c.isPaused} disabled={busy} onCheckedChange={(v) => run({ op: "update_customer", customerId, isPaused: v }, v ? "Paused." : "Reminders back on.")} />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Opted out</span>
            <span className="block text-sm text-muted-foreground">{c.optedOutAt ? `Since ${day(c.optedOutAt.slice(0, 10))}. They asked not to be contacted.` : "Turn on if they asked you to stop (for example, replied STOP)."}</span>
          </span>
          <Switch checked={!!c.optedOutAt} disabled={busy} onCheckedChange={(v) => run({ op: "update_customer", customerId, optedOut: v }, v ? "They won't be contacted again." : "Opt-out removed.")} />
        </label>
      </section>

      <section aria-labelledby="inv" className="flex flex-col gap-2">
        <h3 id="inv" className="font-semibold">Invoices</h3>
        <ul className="flex flex-col divide-y rounded-card border bg-surface">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.invoiceNo}</span>
                <span className="block text-sm text-muted-foreground">
                  Due {day(i.dueDate)} · {INVOICE_STATUS[i.status]}
                  {i.paidMinor > 0 && i.status === "open" ? ` · ${inr(i.paidMinor)} paid` : ""}
                </span>
              </span>
              <span className="font-semibold tabular">{inr(i.status === "paid" ? i.totalMinor : i.totalMinor - i.paidMinor)}</span>
              {i.status === "open" && (
                <Button size="sm" disabled={busy} onClick={() => run({ op: "mark_paid", invoiceIds: [i.id] }, `${i.invoiceNo} marked paid. Its reminders have stopped.`)}>
                  Mark paid
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hist" className="flex flex-col gap-2">
        <h3 id="hist" className="font-semibold">Reminders</h3>
        {(reminders.data ?? []).length ? (
          <ul className="flex flex-col divide-y rounded-card border bg-surface">
            {(reminders.data ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/agents/my/${instance.id}/message/${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">Reminder {r.stage} · {r.channel === "email" ? "Email" : r.channel === "whatsapp" ? "WhatsApp" : "SMS"}</span>
                    <span className="block truncate text-sm text-muted-foreground">{r.body}</span>
                  </span>
                  <StatusPill status={r.status} label={REMINDER_LABEL[r.status]} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No reminders yet.</p>
        )}
      </section>
    </div>
  );
}

export const REMINDER_LABEL: Record<ChaserReminder["status"], string> = {
  drafted: "Waiting",
  queued: "In your queue",
  approved: "Approved",
  sent: "Sent",
  failed: "Didn't send",
  skipped: "Not sent",
  snoozed: "Needs your OK",
};
