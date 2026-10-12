"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Newspaper, Plus } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getAdminBlogPosts, type AdminBlogPost } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Tab = "published" | "drafts" | "all";

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminBlogPosts(), [], { live: true });
  const [tab, setTab] = useState<Tab>("published");
  const rows = useMemo(() => data?.filter((d) => tab === "all" || (tab === "published" ? d.status === "published" : d.status === "draft")), [data, tab]);

  const columns = useMemo<ColumnDef<AdminBlogPost, unknown>[]>(
    () => [
      { id: "date", accessorFn: (d) => d.publishedAt ?? d.createdAt, header: "Date", enableSorting: true, cell: ({ row }) => timeAgo(row.original.publishedAt ?? row.original.createdAt) },
      {
        id: "post",
        accessorFn: (d) => `${d.title} ${d.slug}`,
        header: "Post",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <Link href={`/admin/blog/${row.original.id}`} className="font-medium hover:underline">{row.original.title}</Link>
            <span className="font-mono text-xs text-muted-foreground">/blog/{row.original.slug} · {row.original.author}</span>
          </span>
        ),
      },
      { id: "status", accessorFn: (d) => d.status, header: "Status", cell: ({ row }) => <StatusPill status={row.original.status} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/admin/blog/${row.original.id}`}>Edit</Link>
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <>
      <title>Blog · PowerProof admin</title>
      <PageHeader
        title="Blog"
        description="Posts on /blog, written here. Publishing puts them live straight away."
        actions={
          <Button asChild>
            <Link href="/admin/blog/new"><Plus aria-hidden /> New post</Link>
          </Button>
        }
      />
      <StatusTabs
        label="Post status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "published", label: "Published", count: data?.filter((d) => d.status === "published").length },
          { value: "drafts", label: "Drafts", count: data?.filter((d) => d.status === "draft").length },
          { value: "all", label: "All", count: data?.length },
        ]}
      />
      <DataTable
        key={tab}
        label="Blog posts"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search title or link"
        empty={<EmptyState icon={Newspaper} title="No posts here." body={tab === "drafts" ? "Drafts wait here until they're published." : "Write the first post for /blog."} action={<Button asChild><Link href="/admin/blog/new"><Plus aria-hidden /> New post</Link></Button>} />}
      />
    </>
  );
}
