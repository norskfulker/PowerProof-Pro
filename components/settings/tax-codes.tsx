"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { StatusPill } from "@/components/pp/status-pill";
import { deleteTaxCode, saveTaxCode } from "@/lib/api";
import type { TaxCode } from "@/lib/types";

const EMPTY: TaxCode = { code: "", kind: "SAC", description: "", rate: 18 };

export function TaxCodes({ codes, onChange }: { codes: TaxCode[]; onChange: (c: TaxCode[]) => void }) {
  const [editing, setEditing] = useState<TaxCode | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [toDelete, setToDelete] = useState<TaxCode | null>(null);

  async function save() {
    if (!editing) return;
    if (editing.description.trim().length < 3) return setError("Describe what this code covers.");
    setPending(true);
    try {
      onChange(await saveTaxCode(editing));
      toast.success(isNew ? "Code added" : "Code updated");
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => { setEditing(EMPTY); setIsNew(true); setError(undefined); }}><Plus aria-hidden /> Add code</Button>
      </div>
      <div className="overflow-hidden rounded-card border">
        <Table aria-label="HSN and SAC codes">
          <TableHeader>
            <TableRow><TableHead>Code</TableHead><TableHead>Covers</TableHead><TableHead className="text-right">GST</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((c) => (
              <TableRow key={c.code}>
                <TableCell><span className="font-mono text-[13px]">{c.kind} {c.code}</span>{c.isDefault && <StatusPill status="default" label="Default" tone="brass" className="ml-2" />}</TableCell>
                <TableCell className="max-w-[320px] truncate whitespace-normal">{c.description}</TableCell>
                <TableCell className="text-right font-mono text-[13px]">{c.rate}%</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.code}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditing(c); setIsNew(false); setError(undefined); }}>Edit</DropdownMenuItem>
                      {!c.isDefault && <DropdownMenuItem onSelect={async () => { onChange(await saveTaxCode({ ...c, isDefault: true })); toast.success(`${c.code} is now the default`); }}><Star aria-hidden /> Make default</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(c)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{isNew ? "Add a tax code" : `Edit ${editing?.code}`}</SheetTitle>
            <SheetDescription>Digital products usually use SAC codes under 9984. Ask your CA if unsure.</SheetDescription>
          </SheetHeader>
          {editing && (
            <form id="taxcode" noValidate className="flex flex-col gap-4 px-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
              <RadioGroup value={editing.kind} onValueChange={(k) => setEditing({ ...editing, kind: k as TaxCode["kind"] })} className="flex gap-6" aria-label="Code type">
                {(["SAC", "HSN"] as const).map((k) => (
                  <label key={k} className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value={k} /> {k} {k === "SAC" ? "(services)" : "(goods)"}</label>
                ))}
              </RadioGroup>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tc-code">Code</Label>
                <Input id="tc-code" inputMode="numeric" className="font-mono" disabled={!isNew} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tc-desc">What it covers</Label>
                <Input id="tc-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tc-rate">GST rate</Label>
                <Select value={String(editing.rate)} onValueChange={(v) => setEditing({ ...editing, rate: Number(v) })}>
                  <SelectTrigger id="tc-rate" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox checked={!!editing.isDefault} onCheckedChange={(v) => setEditing({ ...editing, isDefault: !!v })} /> Use for new products by default
              </label>
            </form>
          )}
          <SheetFooter>
            <Button type="submit" form="taxcode" disabled={pending}>{isNew ? "Add code" : "Save"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.kind} ${toDelete?.code}?`}
        description="Products using it need a new code first. Past invoices keep the old one."
        confirmLabel="Delete code"
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            onChange(await deleteTaxCode(toDelete.code));
            toast.success("Code deleted");
          } catch (e) {
            toast.error("Can't delete it yet", { description: e instanceof Error ? e.message : undefined });
          }
        }}
      />
    </>
  );
}
