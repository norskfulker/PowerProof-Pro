"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormResponses } from "@/components/leads/form-responses";
import { FORM_KEY } from "@/components/page-builder/lead-blocks";
import { Segmented } from "@/components/pp/segmented";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Inbox, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { deleteLead, getLeads, type Lead, type LeadKind } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import { BOOKING_ZONES } from "@/lib/pages/schema";

type Tab = "all" | LeadKind;
const KIND: Record<LeadKind, string> = { lead: "Form", booking: "Booking", newsletter: "Newsletter", contact: "Message" };

const when = (iso: string, zone?: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(iso));
const zoneOf = (l: Lead) => BOOKING_ZONES.find((z) => l.data["Time zone"]?.replace(" ", "_") === z.id)?.id;

/** Everyone who filled in a form, booked a time or joined the newsletter on the store's pages. */
export default function LeadsPage() {
  const { data, loading, error, reload } = useApi(getLeads, [], { live: true });
  // Every lead in one list, or form answers as a table per form (?view=responses)
  const router = useRouter();
  const view = useSearchParams().get("view") === "responses" ? "responses" : "all";
  const [tab, setTab] = useState<Tab>("all");
  const [toDelete, setToDelete] = useState<Lead[]>();
  const [clearPicked, setClearPicked] = useState<() => void>();
  const count = (k: LeadKind) => (data ?? []).filter((l) => l.kind === k).length;
  const shown = useMemo(() => (data ?? []).filter((l) => tab === "all" || l.kind === tab), [data, tab]);

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(
    () => [
      {
        id: "who",
        accessorFn: (l) => `${l.name ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`,
        header: "Who",
        cell: ({ row: { original: l } }) => (
          <span className="flex flex-col">
            <span className="font-medium">{l.name || l.email || "—"}</span>
            {l.name && l.email && <a href={`mailto:${l.email}`} className="text-xs text-muted-foreground underline-offset-4 hover:underline">{l.email}</a>}
            {l.phone && <span className="text-xs text-muted-foreground">{l.phone}</span>}
          </span>
        ),
      },
      {
        id: "type",
        accessorFn: (l) => KIND[l.kind],
        header: "Type",
        cell: ({ row: { original: l } }) => (
          <span className="flex flex-col items-start gap-1">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{KIND[l.kind]}</span>
            {(l.data[FORM_KEY] || l.pageTitle) && <span className="text-xs text-muted-foreground">{[l.data[FORM_KEY], l.pageTitle].filter(Boolean).join(" · ")}</span>}
          </span>
        ),
      },
      { id: "page", accessorFn: (l) => l.pageTitle ?? "", header: "Page", filterFn: "equals", cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span> },
      {
        id: "details",
        accessorFn: (l) => Object.entries(l.data).map(([k, v]) => `${k} ${v}`).join(" "),
        header: "Details",
        cell: ({ row: { original: l } }) => (
          <span className="flex max-w-md flex-col">
            {l.slotAt && <span className="font-medium">Booked for {when(l.slotAt, zoneOf(l))}{l.minutes ? ` · ${l.minutes} min` : ""}{l.data["Time zone"] ? ` (${l.data["Time zone"]})` : ""}</span>}
            {Object.entries(l.data).filter(([k]) => k !== "Time zone" && k !== FORM_KEY).map(([k, v]) => <span key={k} className="text-muted-foreground"><span className="font-medium text-foreground">{k}:</span> {v}</span>)}
          </span>
        ),
      },
      { id: "received", accessorFn: (l) => l.createdAt, header: "Received", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground" title={formatDate(row.original.createdAt)}>{timeAgo(row.original.createdAt)}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row: { original: l } }) => <Button variant="ghost" size="icon-sm" aria-label={`Delete ${l.name || l.email || "this lead"}`} onClick={() => setToDelete([l])}><Trash2 /></Button>,
      },
    ],
    []
  );
  const pages = [...new Set((data ?? []).map((l) => l.pageTitle).filter((t): t is string => !!t))];

  return (
    <>
      <PageHeader
        title="Leads"
        description="People who filled in a form, booked a time, joined your newsletter or wrote to your store."
        actions={
          <>
            <Button asChild variant="secondary"><Link href="/store/current/design/pages/home/edit?panel=pages">Make a page</Link></Button>
          </>
        }
      />
      <Segmented
        label="Show"
        value={view}
        onChange={(v) => router.replace(v === "responses" ? "/sales/leads?view=responses" : "/sales/leads", { scroll: false })}
        options={[{ value: "all", label: "All leads" }, { value: "responses", label: "Form responses" }]}
        className="mb-4"
      />
      {view === "responses" ? (
        <FormResponses leads={data} loading={loading} error={error} onRetry={reload} />
      ) : (
      <>
      <StatusTabs
        label="Type of lead"
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tabs={[
          { value: "all", label: "All", count: data?.length },
          { value: "lead", label: "Forms", count: data ? count("lead") : undefined },
          { value: "booking", label: "Bookings", count: data ? count("booking") : undefined },
          { value: "newsletter", label: "Newsletter", count: data ? count("newsletter") : undefined },
          { value: "contact", label: "Messages", count: data ? count("contact") : undefined },
        ]}
      />
      <DataTable
        key={tab}
        label="Leads"
        columns={columns}
        data={data ? shown : undefined}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search name, email or answers"
        defaultHidden={["page"]}
        rowId={(l) => l.id}
        selectable
        bulkActions={(list, clear) => (
          <>
            {list.some((l) => l.email) && <Button size="sm" variant="secondary" asChild><a href={`mailto:?bcc=${encodeURIComponent(list.map((l) => l.email).filter(Boolean).join(","))}`}>Email {list.filter((l) => l.email).length}</a></Button>}
            <Button size="sm" variant="destructive" onClick={() => { setToDelete(list); setClearPicked(() => clear); }}><Trash2 aria-hidden /> Delete</Button>
          </>
        )}
        filters={pages.length > 1 ? [{ columnId: "page", label: "Pages", options: pages.map((t) => ({ value: t, label: t })) }] : []}
        dateFilter={{ get: (l) => l.createdAt, label: "Received" }}
        summary={(rows) => {
          const week = Date.now() - 7 * 86_400_000;
          const upcoming = rows.filter((l) => l.slotAt && Date.parse(l.slotAt) > Date.now());
          return [
            { label: "Leads", value: rows.length.toLocaleString("en-IN") },
            { label: "This week", value: rows.filter((l) => Date.parse(l.createdAt) >= week).length },
            { label: "With an email", value: rows.filter((l) => l.email).length },
            ...(rows.some((l) => l.kind === "booking") ? [{ label: "Upcoming bookings", value: upcoming.length, hint: upcoming[0] ? `Next ${when(upcoming.sort((a, b) => Date.parse(a.slotAt!) - Date.parse(b.slotAt!))[0].slotAt!, zoneOf(upcoming[0]))}` : undefined }] : []),
          ];
        }}
        csv={{
          filename: "leads",
          columns: [
            { header: "Type", value: (l) => KIND[l.kind] },
            { header: "Name", value: (l) => l.name },
            { header: "Email", value: (l) => l.email },
            { header: "Phone", value: (l) => l.phone },
            { header: "Booked for", value: (l) => (l.slotAt ? when(l.slotAt, zoneOf(l)) : "") },
            { header: "Page", value: (l) => l.pageTitle },
            { header: "Form", value: (l) => l.data[FORM_KEY] },
            { header: "Answers", value: (l) => Object.entries(l.data).filter(([k]) => k !== FORM_KEY).map(([k, v]) => `${k}: ${v}`).join("; ") },
            { header: "Received", value: (l) => l.createdAt },
          ],
        }}
        mobileCard={(l) => (
          <div className="flex items-start gap-3 rounded-card border bg-surface p-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{l.name || l.email || "—"}</span>
              <span className="block text-sm text-muted-foreground">{KIND[l.kind]}{l.pageTitle ? ` · ${l.pageTitle}` : ""} · {timeAgo(l.createdAt)}</span>
              {l.slotAt && <span className="block text-sm font-medium">Booked for {when(l.slotAt, zoneOf(l))}</span>}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${l.name || l.email || "this lead"}`} onClick={() => setToDelete([l])}><Trash2 /></Button>
          </div>
        )}
        empty={
          <EmptyState
            icon={Inbox}
            title={tab === "all" ? "No leads yet." : `No ${KIND[tab as LeadKind].toLowerCase()} leads yet.`}
            body="Add a lead form, a booking calendar or a squeeze page to your store, publish it and share the link."
            action={<Button asChild><Link href="/store/current/design/pages/home/edit?panel=pages">Make a page</Link></Button>}
          />
        }
      />
      </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) { setToDelete(undefined); setClearPicked(undefined); } }}
        title={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} leads?` : "Delete this lead?"}
        description={toDelete?.some((l) => l.kind === "booking") ? "Booked times become free again. This can't be undone." : "Removed from your list for good."}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!toDelete) return;
          for (const l of toDelete) await deleteLead(l.id);
          toast.success(toDelete.length > 1 ? `${toDelete.length} leads deleted` : "Lead deleted");
          clearPicked?.();
          reload();
        }}
      />
    </>
  );
}
