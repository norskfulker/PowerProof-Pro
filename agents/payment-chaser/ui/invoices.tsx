"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { daysSince } from "@/components/agents/bits";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { chaserOp, type AgentInstance } from "@/lib/api/agents";
import { addDays } from "@/lib/agents/time";
import { day, inr, useChaser } from "./shared";

type Tab = "overdue" | "due_soon" | "paid" | "paused";

/** Every invoice, by what needs doing: overdue, due in the next 7 days, paid, paused (incl. disputed and written off) */
export function InvoicesView({ instance }: { instance: AgentInstance }) {
  const { derived, loading, error, reload } = useChaser();
  const [tab, setTab] = useState<Tab>("overdue");
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const inv = derived?.invoices ?? [];
    const today = derived?.today ?? "";
    const soon = today ? addDays(today, 7) : "";
    return {
      overdue: inv.filter((i) => i.status === "open" && i.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      due_soon: inv.filter((i) => i.status === "open" && i.dueDate >= today && i.dueDate <= soon).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      paid: inv.filter((i) => i.status === "paid").sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? "")),
      paused: inv.filter((i) => i.status === "paused" || i.status === "disputed" || i.status === "written_off"),
    };
  }, [derived]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !derived) return <Skeleton className="h-64 rounded-card" />;
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
  const list = groups[tab];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs<Tab>
          label="Which invoices"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overdue", label: "Overdue", count: groups.overdue.length },
            { value: "due_soon", label: "Due this week", count: groups.due_soon.length },
            { value: "paid", label: "Paid", count: groups.paid.length },
            { value: "paused", label: "Paused", count: groups.paused.length },
          ]}
        />
        <Button asChild variant="secondary">
          <Link href={`/agents/my/${instance.id}/upload`}>
            <Plus aria-hidden /> Add invoices
          </Link>
        </Button>
      </div>
      {list.length ? (
        <ul className="flex flex-col divide-y rounded-card border bg-surface">
          {list.map((i) => {
            const c = derived.customerById.get(i.customerId);
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <Link href={`/agents/my/${instance.id}/customers/${i.customerId}`} className="block truncate font-semibold hover:underline">
                    {c?.name ?? "Customer"}
                  </Link>
                  <span className="block text-sm text-muted-foreground">
                    {i.invoiceNo} · due {day(i.dueDate)}
                    {tab === "overdue" ? ` · ${daysSince(i.dueDate)} days late` : ""}
                    {tab === "paid" && i.paidAt ? ` · paid ${day(i.paidAt.slice(0, 10))}` : ""}
                    {tab === "paused" ? ` · ${i.status === "written_off" ? "written off" : i.status}` : ""}
                  </span>
                </span>
                <span className="font-semibold tabular">{inr(i.status === "paid" ? i.totalMinor : i.totalMinor - i.paidMinor)}</span>
                {i.status === "open" ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => run({ op: "mark_paid", invoiceIds: [i.id] }, `${i.invoiceNo} marked paid. Its reminders have stopped.`)}>
                      Mark paid
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary" disabled={busy} aria-label={`More for ${i.invoiceNo}`}>
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => run({ op: "set_status", invoiceIds: [i.id], status: "paused" }, "Paused. No reminders for it.")}>Pause reminders</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => run({ op: "set_status", invoiceIds: [i.id], status: "disputed" }, "Marked disputed. No reminders for it.")}>Customer disputes it</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => run({ op: "set_status", invoiceIds: [i.id], status: "written_off" }, "Written off. No reminders for it.")}>Write it off</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : i.status !== "paid" ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run({ op: "set_status", invoiceIds: [i.id], status: "open" }, "Reminders back on for it.")}>
                    Resume
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={FileText} compact title={tab === "overdue" ? "Nothing overdue." : tab === "due_soon" ? "Nothing due this week." : tab === "paid" ? "No paid invoices yet." : "Nothing paused."} />
      )}
    </div>
  );
}
