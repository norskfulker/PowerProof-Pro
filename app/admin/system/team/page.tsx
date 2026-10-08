"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { UserCog } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getAdminTeam, type AdminPerson } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminTeam(), []);
  const columns = useMemo<ColumnDef<AdminPerson, unknown>[]>(
    () => [
      {
        id: "person",
        accessorFn: (p) => `${p.name} ${p.email}`,
        header: "Person",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name || row.original.email}</span>
            {row.original.name && <span className="text-xs text-muted-foreground">{row.original.email}</span>}
          </span>
        ),
      },
      { id: "since", accessorFn: (p) => p.since, header: "Account opened", cell: ({ row }) => formatDate(row.original.since) },
      { id: "seen", accessorFn: (p) => p.lastSignIn ?? "", header: "Last signed in", cell: ({ row }) => (row.original.lastSignIn ? timeAgo(row.original.lastSignIn) : <span className="text-muted-foreground">Never</span>) },
    ],
    []
  );
  return (
    <>
      <title>Team · PowerProof admin</title>
      <PageHeader title="Team" description="Everyone with access to this console." />
      <p className="mb-4 max-w-2xl rounded-card border bg-surface-sunken px-4 py-3 text-sm">
        Admin access is given and taken away in the Supabase dashboard, not here: open Authentication › Users, pick the person, and set their app metadata to <span className="font-mono">{`{"role": "admin"}`}</span> (or clear it). They sign out and in once for it to apply. Keeping that step outside the app means no one in the app can make themselves, or anyone else, staff.
      </p>
      <DataTable label="Admins" columns={columns} data={data} loading={loading && !data} error={error} onRetry={reload} searchPlaceholder="Search name or email" empty={<EmptyState icon={UserCog} title="No admins found." />} />
    </>
  );
}
