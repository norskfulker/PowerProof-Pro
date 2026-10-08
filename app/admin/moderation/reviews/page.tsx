"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Segmented } from "@/components/pp/segmented";
import { Stars } from "@/components/pp/stars";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getAdminContent, moderateContent, type AdminContent } from "@/lib/api";
import { timeAgo } from "@/lib/format";

export default function Page() {
  const [kind, setKind] = useState<"review" | "question">("review");
  const { data, loading, error, reload } = useApi(() => getAdminContent(kind), [kind], { live: true });
  const [hide, setHide] = useState<AdminContent>();

  const columns = useMemo<ColumnDef<AdminContent, unknown>[]>(
    () => [
      { id: "date", accessorFn: (c) => c.createdAt, header: "Posted", enableSorting: true, cell: ({ row }) => timeAgo(row.original.createdAt) },
      {
        id: "text",
        accessorFn: (c) => `${c.author} ${c.title} ${c.body} ${c.storeName} ${c.productTitle}`,
        header: kind === "review" ? "Review" : "Question",
        cell: ({ row }) => (
          <span className="flex max-w-[420px] flex-col gap-0.5">
            {row.original.rating != null && <Stars value={row.original.rating} />}
            {row.original.title && <span className="font-semibold">{row.original.title}</span>}
            <span className="line-clamp-3 text-sm">{row.original.body}</span>
            <span className="text-xs text-muted-foreground">{row.original.author} · {row.original.storeName}{row.original.productTitle ? ` · ${row.original.productTitle}` : ""}</span>
          </span>
        ),
      },
      {
        id: "reports",
        accessorFn: (c) => c.openReports,
        header: "Reports",
        enableSorting: true,
        cell: ({ row }) => (row.original.openReports ? <StatusPill status="reported" label={`${row.original.openReports} open`} /> : <span className="text-muted-foreground">None</span>),
      },
      { id: "status", accessorFn: (c) => (c.hidden ? "hidden" : "shown"), header: "Showing", filterFn: "equals", cell: ({ row }) => <StatusPill status={row.original.hidden ? "hidden" : "shown"} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.hidden ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                moderateContent(kind, row.original.id, false).then(
                  () => toast.success("Showing again"),
                  (e: Error) => toast.error(e.message)
                )
              }
            >
              Show again
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="text-danger" onClick={() => setHide(row.original)}>Hide</Button>
          ),
      },
    ],
    [kind]
  );

  return (
    <>
      <title>Review moderation · PowerProof admin</title>
      <PageHeader title="Review moderation" description="Hide or keep reviews and questions on any store." />
      <Segmented
        label="What to moderate"
        value={kind}
        onChange={setKind}
        className="mb-4"
        options={[
          { value: "review", label: "Reviews" },
          { value: "question", label: "Questions" },
        ]}
      />
      <DataTable
        key={kind}
        label={kind === "review" ? "Reviews" : "Questions"}
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder={`Search ${kind === "review" ? "reviews" : "questions"}`}
        filters={[{ columnId: "status", label: "Showing", options: [{ value: "shown", label: "Shown" }, { value: "hidden", label: "Hidden" }] }]}
        empty={<EmptyState icon={MessagesSquare} title={`No ${kind === "review" ? "reviews" : "questions"} yet.`} body="They appear here as buyers write them." />}
      />
      <ReasonDialog
        open={!!hide}
        onOpenChange={(o) => !o && setHide(undefined)}
        title={`Hide this ${kind}?`}
        description="It disappears from the store at once. The reason is written to the audit log."
        confirmLabel="Hide"
        placeholder="For example: abusive language"
        onConfirm={async (reason) => {
          await moderateContent(kind, hide!.id, true, reason);
          toast.success("Hidden");
        }}
      />
    </>
  );
}
