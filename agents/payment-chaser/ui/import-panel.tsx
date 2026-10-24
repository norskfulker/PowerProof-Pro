"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, PenLine } from "lucide-react";
import { toast } from "sonner";
import { GoogleSheetButton } from "@/components/agents/google-sheet";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chaserOp, type AgentInstance, type ImportSummary } from "@/lib/api/agents";
import { parseCsv } from "@/lib/csv";
import { readXlsx, XlsxError } from "@/lib/agents/xlsx";
import { detectMapping, FIELD_LABELS, FIELDS, mappingProblems, MAX_FILE_BYTES, MAX_ROWS, type Field, type Mapping } from "../lib/parse";
import { inr } from "./shared";

type Mode = "file" | "sheet" | "manual";

/** Bring invoices in: a CSV or Excel file (columns matched, or picked by hand with a preview), a Google Sheet, or one by hand */
export function ImportPanel({ instance, onImported }: { instance: AgentInstance; onImported?: (s: ImportSummary | null) => void }) {
  const [mode, setMode] = useState<Mode>("file");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const done = (s: ImportSummary | null) => {
    setSummary(s);
    onImported?.(s);
  };
  return (
    <div className="flex flex-col gap-5">
      <Segmented<Mode>
        label="How to add invoices"
        value={mode}
        onChange={setMode}
        options={[
          { value: "file", label: "Upload a file" },
          { value: "sheet", label: "Google Sheet" },
          { value: "manual", label: "Type one in" },
        ]}
      />
      {mode === "file" && <FileImport onDone={done} />}
      {mode === "sheet" && <GoogleSheetButton instanceId={instance.id} onDone={(s) => done((s as ImportSummary | null) ?? null)} />}
      {mode === "manual" && <ManualInvoice onDone={done} />}
      {summary && <ImportReport summary={summary} onChanged={() => setSummary({ ...summary, missing: [] })} />}
    </div>
  );
}

function FileImport({ onDone }: { onDone: (s: ImportSummary) => void }) {
  const [file, setFile] = useState<{ name: string; source: "csv" | "xlsx"; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isFull, setIsFull] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function read(f: File) {
    setError(undefined);
    setFile(null);
    if (f.size > MAX_FILE_BYTES) return setError("That file is over 5 MB. Remove extra sheets or columns, or save it as CSV.");
    const isXlsx = /\.xlsx$/i.test(f.name);
    if (!isXlsx && !/\.csv$/i.test(f.name)) return setError("Upload a .csv or .xlsx file. Older .xls files: open them and save as .xlsx.");
    try {
      const rows = isXlsx ? await readXlsx(await f.arrayBuffer(), { maxRows: MAX_ROWS + 1 }) : parseCsv(await f.text());
      if (rows.length < 2) return setError("The file has no rows under the headers.");
      if (rows.length > MAX_ROWS + 1) return setError(`Up to ${MAX_ROWS.toLocaleString("en-IN")} rows at a time. Split the file and upload each part.`);
      const trimmed = rows.map((r) => r.slice(0, 40).map((c) => String(c).slice(0, 500)));
      setFile({ name: f.name, source: isXlsx ? "xlsx" : "csv", rows: trimmed });
      setMapping(detectMapping(trimmed[0]));
    } catch (e) {
      setError(e instanceof XlsxError ? e.message : "We couldn't read that file. Save it as CSV and try again.");
    }
  }

  const problems = file ? mappingProblems(mapping) : [];
  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed bg-surface p-6 text-center hover:border-primary/50">
        <FileUp className="size-6 text-muted-foreground" aria-hidden />
        <span className="font-semibold">{file ? file.name : "Choose your invoice file"}</span>
        <span className="text-sm text-muted-foreground">CSV or Excel (.xlsx), up to 5 MB and 5,000 rows</span>
        <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {file && (
        <>
          <ColumnMapping headers={file.rows[0]} sample={file.rows.slice(1, 6)} mapping={mapping} onChange={setMapping} />
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <Checkbox checked={isFull} onCheckedChange={(c) => setIsFull(c === true)} className="mt-0.5" />
            <span>This is my full list of unpaid invoices (we&apos;ll ask about any that are missing from it)</span>
          </label>
          {problems.length > 0 && <p className="text-sm text-warning-ink">{problems.join(" ")}</p>}
          <Button
            size="lg"
            disabled={busy || problems.length > 0}
            onClick={async () => {
              setBusy(true);
              setError(undefined);
              try {
                const r = await chaserOp<{ summary: ImportSummary }>({ op: "import", source: file.source, fileName: file.name, isFull, rows: file.rows, mapping });
                onDone(r.summary);
                setFile(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "The upload didn't work. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : `Import ${(file.rows.length - 1).toLocaleString("en-IN")} rows`}
          </Button>
        </>
      )}
    </div>
  );
}

const NONE = "__none";

/** Which column holds what, with the first five rows to check against */
function ColumnMapping({ headers, sample, mapping, onChange }: { headers: string[]; sample: string[][]; mapping: Mapping; onChange: (m: Mapping) => void }) {
  const used = Object.values(mapping);
  return (
    <div className="flex flex-col gap-4 rounded-card border bg-surface p-4">
      <p className="text-sm text-muted-foreground">We matched your columns. Check them, and change any that are wrong.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f: Field) => (
          <div key={f} className="flex flex-col gap-1">
            <Label className="text-sm">{FIELD_LABELS[f]}</Label>
            <Select value={mapping[f] === undefined ? NONE : String(mapping[f])} onValueChange={(v) => onChange({ ...mapping, [f]: v === NONE ? undefined : Number(v) })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not in my file</SelectItem>
                {headers.map((h, i) => (
                  <SelectItem key={i} value={String(i)} disabled={used.includes(i) && mapping[f] !== i}>
                    {h || `Column ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="-mx-4 overflow-x-auto px-4" tabIndex={0} role="region" aria-label="First five rows">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b">
              {FIELDS.filter((f) => mapping[f] !== undefined).map((f) => (
                <th key={f} className="py-2 pr-3 font-semibold">{FIELD_LABELS[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                {FIELDS.filter((f) => mapping[f] !== undefined).map((f) => (
                  <td key={f} className="max-w-48 truncate py-2 pr-3">{r[mapping[f]!] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManualInvoice({ onDone }: { onDone: (s: ImportSummary) => void }) {
  const empty = { customerName: "", phone: "", email: "", invoiceNo: "", amount: "", dueDate: "" };
  const [v, setV] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const field = (k: keyof typeof empty, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`mi-${k}`}>{label}</Label>
      <Input id={`mi-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...props} />
    </div>
  );
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
          const r = await chaserOp<{ summary: ImportSummary }>({ op: "add_invoice", invoice: { ...v, phone: v.phone || undefined, email: v.email || undefined } });
          toast.success(`Invoice ${v.invoiceNo} added.`);
          setV(empty);
          onDone(r.summary);
        } catch (err) {
          setError(err instanceof Error ? err.message : "That didn't save. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("customerName", "Customer name", { required: true, autoComplete: "off" })}
        {field("invoiceNo", "Invoice number", { required: true })}
        {field("amount", "Amount pending (₹)", { required: true, inputMode: "decimal", placeholder: "25,000" })}
        {field("dueDate", "Due date", { required: true, type: "date" })}
        {field("phone", "Mobile (for WhatsApp)", { type: "tel", inputMode: "tel", placeholder: "98765 43210" })}
        {field("email", "Email", { type: "email", inputMode: "email" })}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>
        <PenLine aria-hidden /> {busy ? "Saving…" : "Add invoice"}
      </Button>
    </form>
  );
}

/** What the import did, row by row; disappeared invoices wait for the owner's decision */
export function ImportReport({ summary: s, onChanged }: { summary: ImportSummary; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const notes = [...s.problems.map((p) => ({ row: p.row, text: p.reason, bad: true })), ...s.warnings.map((w) => ({ row: w.row, text: w.warning, bad: false }))].sort((a, b) => a.row - b.row);
  return (
    <div className="flex flex-col gap-4 rounded-card border bg-surface p-4" role="status">
      <p className="flex items-center gap-2 font-semibold">
        <CheckCircle2 className="size-5 text-success" aria-hidden /> {s.imported} new, {s.updated} updated{s.failed ? `, ${s.failed} skipped` : ""}
        {s.markedPaid ? `, ${s.markedPaid} now paid` : ""}
      </p>
      {notes.length > 0 && (
        <div>
          <ul className="flex flex-col gap-1 text-sm">
            {(showAll ? notes : notes.slice(0, 8)).map((n, i) => (
              <li key={i} className={n.bad ? "text-danger" : "text-muted-foreground"}>
                Row {n.row}: {n.text}
              </li>
            ))}
          </ul>
          {notes.length > 8 && (
            <Button variant="link" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${notes.length}`}
            </Button>
          )}
        </div>
      )}
      {s.missing.length > 0 && s.importId && (
        <div className="flex flex-col gap-3 rounded-control border border-warning/40 bg-warning-soft/40 p-3">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
            <span>
              These {s.missing.length} invoices disappeared from your file ({inr(s.missing.reduce((n, m) => n + m.outstandingMinor, 0))}). Mark them paid? Until you do, they stay unpaid.
            </span>
          </p>
          <ul className="max-h-40 overflow-y-auto text-sm text-muted-foreground">
            {s.missing.map((m) => (
              <li key={m.id}>
                {m.invoiceNo} · {m.customer} · {inr(m.outstandingMinor)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await chaserOp({ op: "confirm_missing", importId: s.importId, invoiceIds: s.missing.map((m) => m.id) });
                  toast.success("Marked paid. Their reminders have stopped.");
                  onChanged?.();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "That didn't save.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Mark {s.missing.length} paid
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await chaserOp({ op: "confirm_missing", importId: s.importId, invoiceIds: [] });
                  onChanged?.();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Keep them unpaid
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
