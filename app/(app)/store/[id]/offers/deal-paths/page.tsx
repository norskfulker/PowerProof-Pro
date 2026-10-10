"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { KIND_LABEL, RuleSummaryChip } from "@/components/pp/deal-parts";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { NoData, StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { dealRuleStatus, deleteDealRule, getDealRules, getProducts, setDealRuleActive } from "@/lib/api";
import type { DealRule } from "@/lib/types";

export default function DealPathsPage() {
  const { data, loading, error, reload, setData } = useApi(() => Promise.all([getDealRules(), getProducts()]), [], { live: true });
  const [toDelete, setToDelete] = useState<DealRule>();
  const rules = data?.[0];
  const titleOf = useMemo(() => (id: string) => data?.[1].find((p) => p.id === id)?.title ?? "a product", [data]);

  async function toggle(r: DealRule, active: boolean) {
    try {
      const saved = await setDealRuleActive(r.id, active);
      if (data) setData([data[0].map((x) => (x.id === r.id ? saved : x)), data[1]]);
      toast.success(active ? `${r.name} is on` : `${r.name} is paused`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    }
  }

  const columns = useMemo<ColumnDef<DealRule, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: "Deal path",
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col gap-1">
            <Link href={`/store/current/offers/deal-paths/${row.original.id}`} className="inline-flex min-h-11 items-center font-semibold hover:underline [overflow-wrap:anywhere]">
              {row.original.name}
            </Link>
            <RuleSummaryChip rule={row.original} titleOf={titleOf} className="self-start" />
          </span>
        ),
      },
      { id: "kind", accessorFn: (r) => KIND_LABEL[r.kind], header: "Type" },
      { id: "status", accessorFn: (r) => dealRuleStatus(r), header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      {
        id: "on",
        header: "On",
        cell: ({ row }) => <Switch checked={row.original.active} onCheckedChange={(v) => toggle(row.original, v)} aria-label={`${row.original.name} is switched on`} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More for ${row.original.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/store/current/offers/deal-paths/${row.original.id}`}>Edit and see stats</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger" onSelect={() => setToDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // toggle closes over data; rebuild when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [titleOf, data]
  );

    const live = (rules ?? []).filter((r) => dealRuleStatus(r) === "active").length;

  return (
    <>
      <title>Deal paths · PowerProof</title>
      <PageHeader
        title="Deal paths"
        back={{ href: "/store/current/offers/coupons", label: "Offers" }}
        description="Little rewards at checkout: buy two and save, a free gift over a spend, the cheapest one free. Buyers always get the best price automatically."
        actions={
          <Button asChild>
            <Link href="/store/current/offers/deal-paths/new">
              <Plus aria-hidden /> New deal path
            </Link>
          </Button>
        }
      />
      {rules && rules.length > 0 && (
        <section aria-label="All deal paths" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Running now" value={live} />
          <StatCard label="Orders that used one" value={<NoData />} />
          <StatCard label="Take-up" value={<NoData />} hint="Orders ÷ times shown" />
          <StatCard label="Extra revenue" value={<NoData />} />
        </section>
      )}
      <DataTable
        label="Deal paths"
        columns={columns}
        data={rules}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search deal paths"
        filters={[{ columnId: "status", label: "Statuses", options: ["active", "scheduled", "paused", "ended"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) }]}
        empty={
          <EmptyState
            icon={Sparkles}
            title="No deal paths yet"
            body="Start with one: a free gift over a spend works well for most stores."
            action={
              <Button asChild>
                <Link href="/store/current/offers/deal-paths/new">
                  <Plus aria-hidden /> New deal path
                </Link>
              </Button>
            }
          />
        }
        mobileCard={(r) => (
          <div className="flex flex-col gap-3 rounded-card border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/store/current/offers/deal-paths/${r.id}`} className="inline-flex min-h-11 items-center font-semibold hover:underline [overflow-wrap:anywhere]">
                {r.name}
              </Link>
              <StatusPill status={dealRuleStatus(r)} />
            </div>
            <RuleSummaryChip rule={r} titleOf={titleOf} className="self-start" />
            <label className="flex min-h-11 items-center justify-between gap-3 border-t pt-3 text-sm">
              Switched on
              <Switch checked={r.active} onCheckedChange={(v) => toggle(r, v)} aria-label={`${r.name} is switched on`} />
            </label>
          </div>
        )}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title={`Delete ${toDelete?.name ?? "this deal path"}?`}
        description="Buyers stop seeing it straight away. Orders that already used it keep their price."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteDealRule(toDelete.id);
          toast.success("Deleted");
          reload();
        }}
      />
    </>
  );
}
