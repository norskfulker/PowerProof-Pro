"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getAdminStores, type AdminStoreRow } from "@/lib/api";

const THEME = { light: "Light", dark: "Dark", auto: "Auto" } as const;

export default function AdminStoresPage() {
  const { data, loading, error, reload } = useApi(getAdminStores, []);
  const columns = useMemo<ColumnDef<AdminStoreRow, unknown>[]>(
    () => [
      {
        id: "store",
        accessorFn: (s) => `${s.name} ${s.slug} ${s.owner}`,
        header: "Store",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.owner}</span>
          </span>
        ),
      },
      { accessorKey: "products", header: "Products", meta: { align: "right" }, enableSorting: true },
      { id: "status", accessorFn: (s) => (s.live ? "live" : "draft"), header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { accessorKey: "theme", header: "Theme", cell: ({ getValue }) => THEME[getValue() as AdminStoreRow["theme"]] },
      { id: "domain", header: "Domain", cell: ({ row }) => <span className="font-mono text-xs">{row.original.domain ?? `${row.original.slug}.powerproof.store`}</span> },
      {
        id: "open",
        header: () => <span className="sr-only">Open</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Link href={`/s/${row.original.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" aria-label={`Open ${row.original.name}`}>
            Open <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ),
      },
    ],
    []
  );
  return (
    <>
      <PageHeader title="Stores" description="Every store on PowerProof, with its status, theme and domain." />
      <DataTable
        label="Stores"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search stores or owners"
        filters={[{ columnId: "status", label: "Statuses", options: [{ value: "live", label: "Live" }, { value: "draft", label: "Draft" }] }]}
        mobileCard={(s) => (
          <div className="flex items-center gap-3 rounded-card border bg-surface p-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{s.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {s.owner} · {s.products} products
              </span>
            </span>
            <StatusPill status={s.live ? "live" : "draft"} />
          </div>
        )}
      />
    </>
  );
}
