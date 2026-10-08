"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import type { TaxCode } from "@/lib/types";

export interface NewTaxCode {
  code: string;
  kind: "HSN" | "SAC";
  description?: string;
  rate: number;
}

/**
 * The GST reference codes, then the creator's own. Your own are saved on the store (tax_codes) and
 * can be added or removed here; a product keeps the code and rate it was given, so removing one
 * never changes an invoice.
 */
export function TaxCodes({ codes, onAdd, onDelete }: { codes: TaxCode[]; onAdd: (c: NewTaxCode) => Promise<unknown>; onDelete: (id: string) => Promise<unknown> }) {
  const [draft, setDraft] = useState({ code: "", kind: "SAC" as "HSN" | "SAC", description: "", rate: "18" });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<TaxCode>();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const rate = Number(draft.rate);
    if (!/^\d{4,8}$/.test(draft.code)) return setError("Codes are 4 to 8 digits.");
    if (draft.rate === "" || !Number.isFinite(rate) || rate < 0 || rate > 40) return setError("GST is between 0% and 40%.");
    setBusy(true);
    try {
      await onAdd({ code: draft.code, kind: draft.kind, description: draft.description, rate });
      setDraft({ code: "", kind: draft.kind, description: "", rate: draft.rate });
      toast.success("Code added", { description: `${draft.kind} ${draft.code} at ${rate}% is ready to pick on a product.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-card border">
        <Table aria-label="HSN and SAC codes">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Covers</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((c) => (
              <TableRow key={`${c.code}:${c.rate}`}>
                <TableCell><span className="font-mono text-[0.8125rem]">{c.kind} {c.code}</span></TableCell>
                <TableCell className="max-w-[320px] truncate whitespace-normal">{c.description}{c.id && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">Yours</span>}</TableCell>
                <TableCell className="text-right font-mono text-[0.8125rem]">{c.rate}%</TableCell>
                <TableCell className="text-right">
                  {c.id && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${c.code}`} onClick={() => setToDelete(c)}><Trash2 /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <form onSubmit={add} noValidate className="flex flex-col gap-3 rounded-card border bg-surface-sunken p-4" aria-label="Add your own code">
        <p className="text-sm font-semibold">Add your own code</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_7rem_minmax(0,1fr)_6rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-code">Code</Label>
            <Input id="tc-code" className="font-mono" inputMode="numeric" maxLength={8} placeholder="e.g. 998439" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-kind">Type</Label>
            <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as "HSN" | "SAC" })}>
              <SelectTrigger id="tc-kind" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SAC">SAC (services)</SelectItem>
                <SelectItem value="HSN">HSN (goods)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-desc">What it covers (optional)</Label>
            <Input id="tc-desc" maxLength={120} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-rate">GST (%)</Label>
            <Input id="tc-rate" type="number" min={0} max={40} step="0.5" inputMode="decimal" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} />
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="self-start"><Plus aria-hidden /> Add code</Button>
      </form>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title={`Remove ${toDelete?.code ?? "this code"}?`}
        description="Products that already use it keep it and their invoices don't change. It just won't be in the list any more."
        confirmLabel="Remove code"
        onConfirm={async () => {
          if (!toDelete?.id) return;
          await onDelete(toDelete.id);
          toast.success("Code removed");
        }}
      />
    </div>
  );
}
