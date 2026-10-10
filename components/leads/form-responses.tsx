"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, ClipboardList } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { FORM_KEY } from "@/components/page-builder/lead-blocks";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Lead } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";

/** One form on one page, and everything sent through it */
export interface FormGroup {
  key: string;
  page: string;
  form: string;
  /** The form's questions, in the order people first answered them */
  fields: string[];
  rows: Lead[];
}

/** Form submissions grouped by the page and form they came from, busiest first */
export function groupForms(leads: Lead[]): FormGroup[] {
  const groups = new Map<string, FormGroup>();
  for (const l of leads) {
    if (l.kind !== "lead") continue;
    const page = l.pageTitle ?? "Store home";
    const form = l.data[FORM_KEY] || "Form";
    const key = `${page}\u0000${form}`;
    const g = groups.get(key) ?? { key, page, form, fields: [], rows: [] };
    for (const k of Object.keys(l.data)) if (k !== FORM_KEY && !g.fields.includes(k)) g.fields.push(k);
    g.rows.push(l);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
}

export const formLabel = (g: Pick<FormGroup, "page" | "form">) => `${g.form} · ${g.page}`;

/**
 * Responses to one form as a spreadsheet: one row per person, one column per question. Pick the
 * form at the top; search, filter by date and download as CSV like any other table.
 */
export function FormResponses({ leads, loading, error, onRetry }: { leads: Lead[] | undefined; loading?: boolean; error?: string; onRetry?: () => void }) {
  const groups = useMemo(() => groupForms(leads ?? []), [leads]);
  const [picked, setPicked] = useState<string>();
  const group = groups.find((g) => g.key === picked) ?? groups[0];

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(
    () => [
      { id: "name", accessorFn: (l) => l.name ?? "", header: "Name", cell: ({ getValue }) => <span className="font-medium">{(getValue() as string) || "—"}</span> },
      { id: "email", accessorFn: (l) => l.email ?? "", header: "Email", cell: ({ getValue }) => (getValue() ? <a href={`mailto:${getValue() as string}`} className="underline-offset-4 hover:underline">{getValue() as string}</a> : <span className="text-muted-foreground">—</span>) },
      { id: "phone", accessorFn: (l) => l.phone ?? "", header: "Phone", cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span> },
      ...(group?.fields ?? []).map(
        (f): ColumnDef<Lead, unknown> => ({ id: `f:${f}`, accessorFn: (l) => l.data[f] ?? "", header: f, cell: ({ getValue }) => <span className="block max-w-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{(getValue() as string) || <span className="text-muted-foreground">—</span>}</span> })
      ),
      { id: "received", accessorFn: (l) => l.createdAt, header: "Received", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground" title={formatDate(row.original.createdAt)}>{timeAgo(row.original.createdAt)}</span> },
    ],
    [group]
  );

  if (!loading && !error && groups.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No form responses yet."
        body="Add a form to a page, publish it and share the link. Every answer lands here as a row."
        action={<Button asChild><Link href="/store/current/design/pages/home/edit?panel=pages">Make a page</Link></Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium" id="form-pick-label">Form</span>
          <Select value={group?.key} onValueChange={setPicked}>
            <SelectTrigger className="w-full max-w-md" aria-labelledby="form-pick-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.key} value={g.key}>
                  {formLabel(g)} ({g.rows.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <DataTable
        key={group?.key}
        label={group ? `Responses to ${formLabel(group)}` : "Form responses"}
        columns={columns}
        data={leads ? group?.rows ?? [] : undefined}
        loading={loading && !leads}
        error={error}
        onRetry={onRetry}
        rowId={(l) => l.id}
        searchPlaceholder="Search answers"
        dateFilter={{ get: (l) => l.createdAt, label: "Received" }}
        summary={(rows) => [
          { label: "Responses", value: rows.length.toLocaleString("en-IN") },
          { label: "This week", value: rows.filter((l) => Date.parse(l.createdAt) >= Date.now() - 7 * 86_400_000).length },
          { label: "With an email", value: rows.filter((l) => l.email).length },
        ]}
        csv={{
          filename: group ? `responses-${group.form}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "responses",
          columns: [
            { header: "Name", value: (l) => l.name },
            { header: "Email", value: (l) => l.email },
            { header: "Phone", value: (l) => l.phone },
            ...(group?.fields ?? []).map((f) => ({ header: f, value: (l: Lead) => l.data[f] })),
            { header: "Page", value: (l) => l.pageTitle },
            { header: "Received", value: (l) => l.createdAt },
          ],
        }}
        mobileCard={(l) => (
          <div className="flex flex-col gap-1 rounded-card border bg-surface p-4 text-sm">
            <span className="font-semibold">{l.name || l.email || "—"}</span>
            {l.name && l.email && <span className="text-muted-foreground">{l.email}</span>}
            {group?.fields.map((f) => l.data[f] && <span key={f}><span className="font-medium">{f}:</span> {l.data[f]}</span>)}
            <span className="text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
          </div>
        )}
      />
    </div>
  );
}

/**
 * Dashboard › Analytics: form submissions in the chosen period, by form, with the latest few as a
 * table and the way to all of them.
 */
export function SubmissionsCard({ leads, since, loading }: { leads: Lead[] | undefined; since: number; loading?: boolean }) {
  const inRange = (leads ?? []).filter((l) => Date.parse(l.createdAt) >= since);
  const forms = groupForms(inRange);
  const latest = inRange.slice(0, 6);
  const kinds = { lead: "Form", booking: "Booking", newsletter: "Newsletter", contact: "Message" } as const;
  return (
    <section aria-labelledby="subs-h" className="flex flex-col gap-4 rounded-card border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="subs-h" className="font-display text-lg">Form submissions</h3>
          <p className="text-sm text-muted-foreground">{loading && !leads ? "Loading…" : `${inRange.length} in this period, from forms, bookings, the newsletter and messages.`}</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/sales/leads?view=responses">All responses <ArrowRight aria-hidden /></Link>
        </Button>
      </div>
      {forms.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Submissions by form">
          {forms.map((g) => (
            <li key={g.key} className="rounded-full border px-3 py-1 text-xs">
              <span className="font-medium">{g.form}</span> <span className="text-muted-foreground">· {g.page} · {g.rows.length}</span>
            </li>
          ))}
        </ul>
      )}
      {latest.length === 0 ? (
        <p className="rounded-control border border-dashed p-6 text-center text-sm text-muted-foreground">No submissions in this period yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-control border">
          <table className="w-full text-sm">
            <caption className="sr-only">Latest submissions</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Who</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Form or page</th>
                <th scope="col" className="px-3 py-2 font-medium">Answers</th>
                <th scope="col" className="px-3 py-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((l) => {
                const answers = Object.entries(l.data).filter(([k]) => k !== FORM_KEY && k !== "Time zone");
                return (
                  <tr key={l.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <span className="block font-medium">{l.name || l.email || "—"}</span>
                      {l.name && l.email && <span className="block text-xs text-muted-foreground">{l.email}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{kinds[l.kind]}</td>
                    <td className="px-3 py-2">{l.data[FORM_KEY] ?? l.pageTitle ?? "—"}</td>
                    <td className="max-w-xs px-3 py-2 text-muted-foreground">{answers.length ? answers.map(([k, v]) => `${k}: ${v}`).join(" · ") : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{timeAgo(l.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
