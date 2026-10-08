"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Inbox, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { deleteLead, getLeads, type Lead, type LeadKind } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { BOOKING_ZONES } from "@/lib/pages/schema";

type Tab = "all" | LeadKind;
const KIND: Record<LeadKind, string> = { lead: "Form", booking: "Booking", newsletter: "Newsletter", contact: "Message" };

const when = (iso: string, zone?: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(iso));
const zoneOf = (l: Lead) => BOOKING_ZONES.find((z) => l.data["Time zone"]?.replace(" ", "_") === z.id)?.id;

/** Everyone who filled in a form, booked a time or joined the newsletter on the store's pages. */
export default function LeadsPage() {
  const { data, loading, error, reload } = useApi(getLeads, [], { live: true });
  const [tab, setTab] = useState<Tab>("all");
  const [toDelete, setToDelete] = useState<Lead>();
  const count = (k: LeadKind) => (data ?? []).filter((l) => l.kind === k).length;
  const shown = useMemo(() => (data ?? []).filter((l) => tab === "all" || l.kind === tab), [data, tab]);

  function exportCsv() {
    const rows = [["Type", "Name", "Email", "Phone", "Booked for", "Page", "Answers", "Received"], ...shown.map((l) => [KIND[l.kind], l.name ?? "", l.email ?? "", l.phone ?? "", l.slotAt ? when(l.slotAt, zoneOf(l)) : "", l.pageTitle ?? "", Object.entries(l.data).map(([k, v]) => `${k}: ${v}`).join("; "), l.createdAt])];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="People who filled in a form, booked a time, joined your newsletter or wrote to your store."
        actions={<Button variant="secondary" onClick={exportCsv} disabled={shown.length === 0}><Download aria-hidden /> Export CSV</Button>}
      />
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
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton className="h-64 rounded-card" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "all" ? "No leads yet." : `No ${KIND[tab as LeadKind].toLowerCase()} leads yet.`}
          body="Add a lead form, a booking calendar or a squeeze page to your store, publish it and share the link."
          action={<Button asChild><Link href="/store/current/design/pages">Make a page</Link></Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface-sunken text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.name || l.email || "—"}</p>
                    {l.name && l.email && <a href={`mailto:${l.email}`} className="text-muted-foreground underline-offset-4 hover:underline">{l.email}</a>}
                    {l.phone && <p className="text-muted-foreground">{l.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{KIND[l.kind]}</span>
                    {l.pageTitle && <p className="mt-1 text-xs text-muted-foreground">{l.pageTitle}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {l.slotAt && <p className="font-medium">Booked for {when(l.slotAt, zoneOf(l))}{l.minutes ? ` · ${l.minutes} min` : ""}{l.data["Time zone"] ? ` (${l.data["Time zone"]})` : ""}</p>}
                    {Object.entries(l.data).filter(([k]) => k !== "Time zone").map(([k, v]) => <p key={k} className="text-muted-foreground"><span className="font-medium text-foreground">{k}:</span> {v}</p>)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(l.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${l.name || l.email || "this lead"}`} onClick={() => setToDelete(l)}><Trash2 /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Delete this lead?"
        description={toDelete?.kind === "booking" ? "Their booked time becomes free again." : "It's removed from your list for good."}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteLead(toDelete.id);
          toast.success("Lead deleted");
          reload();
        }}
      />
    </>
  );
}
