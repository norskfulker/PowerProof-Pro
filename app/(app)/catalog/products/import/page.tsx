"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { usePlan } from "@/components/plan/plan-context";
import { PageHeader } from "@/components/pp/page-header";
import { FinishDrafts, type Imported } from "@/components/products/finish-drafts";
import { toInput } from "@/components/products/to-values";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/hooks/use-current-store";
import { createProduct, getCollections, saveCollection, setProductCollections } from "@/lib/api";
import { MAX_IMPORT_ROWS, PRODUCT_COLUMNS, parseProducts, templateCsv, type ImportRow } from "@/lib/products-csv";
import type { Collection } from "@/lib/types";
import { PALETTES } from "@/lib/palettes";
import { formatMoney } from "@/lib/money";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type Result = { made: number; failed: { line: number; title: string; message: string }[]; stopped?: string };

export default function ImportProductsPage() {
  const store = useCurrentStore();
  const plan = usePlan();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileError, setFileError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<Result>();
  const [created, setCreated] = useState<Imported[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  if (!store.data) return <Skeleton className="h-96 rounded-card" />;
  const currency = store.data.currency;
  const good = rows.filter((r) => r.values);

  async function read(file: File | undefined) {
    setResult(undefined);
    setCreated([]);
    setRows([]);
    setFileError(undefined);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) return setFileError("That file is over 2 MB. Split it into smaller files.");
    if (!/\.csv$/i.test(file.name) && !file.type.includes("csv") && file.type !== "text/plain") return setFileError("Choose a .csv file. In Excel or Sheets, use Save as, then CSV.");
    const parsed = parseProducts(await file.text(), currency);
    setRows(parsed.rows);
    setFileError(parsed.fileError);
  }

  async function run() {
    setBusy(true);
    setDone(0);
    const out: Result = { made: 0, failed: [] };
    const made: Imported[] = [];
    try {
      // Collections by name: use what exists, make what doesn't
      let list = await getCollections();
      const idFor = async (name: string) => {
        const have = list.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (have) return have.id;
        list = await saveCollection({ name, productIds: [], cover: { template: "block", title: name, subtitle: "", ...PALETTES[0] } });
        return list.find((c) => c.name.toLowerCase() === name.toLowerCase())!.id;
      };
      setCollections(list);
      for (const r of good) {
        try {
          const p = await createProduct(toInput({ ...r.values!, collectionIds: [] }));
          const collectionId = r.collection ? await idFor(r.collection) : undefined;
          if (collectionId) await setProductCollections(p.id, [collectionId]);
          made.push({ product: p, collectionId });
          out.made++;
        } catch (e) {
          // The plan's product limit ends the run: the rest can't be added either
          if (plan.handleLimitError(e)) {
            out.stopped = "You've reached your plan's product limit, so the rest weren't added.";
            break;
          }
          out.failed.push({ line: r.line, title: r.title, message: e instanceof Error ? e.message : "Couldn't add it." });
        }
        setDone((n) => n + 1);
      }
      setCollections(list);
    } catch (e) {
      out.stopped = e instanceof Error ? e.message : "The import stopped.";
    }
    setResult(out);
    setCreated(made);
    setBusy(false);
    if (out.made) toast.success(`${out.made} product${out.made === 1 ? "" : "s"} added as drafts`, { description: "Not visible to buyers until you publish them." });
  }

  return (
    <>
      <PageHeader back={{ href: "/catalog/products", label: "Products" }} title="Import products" description="Add many products at once from a spreadsheet. They arrive as drafts; add each file or image, then publish." />

      <ol className="flex flex-col gap-6">
        <li className="rounded-card border bg-surface p-5 md:p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">1. Download the format</h2>
          <p className="mt-1 text-sm text-muted-foreground">One row per product, with these columns in the first row. Prices are in {currency}. Up to {MAX_IMPORT_ROWS} products per file.</p>
          <div className="mt-4 overflow-x-auto rounded-control border">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-surface-sunken text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Column</th><th className="px-3 py-2 font-medium">Needed?</th><th className="px-3 py-2 font-medium">What goes in it</th></tr>
              </thead>
              <tbody className="divide-y">
                {PRODUCT_COLUMNS.map((c) => (
                  <tr key={c.key}>
                    <td className="px-3 py-2 font-mono text-[0.8125rem]">{c.key}</td>
                    <td className="px-3 py-2">{c.required ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => download("products-template.csv", templateCsv())}>
            <Download aria-hidden /> Download the CSV template
          </Button>
        </li>

        <li className="rounded-card border bg-surface p-5 md:p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">2. Upload your file</h2>
          <p className="mt-1 text-sm text-muted-foreground">We check every row before anything is added.</p>
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => void read(e.target.files?.[0])} />
          <Button type="button" className="mt-4" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            <Upload aria-hidden /> {fileName ? "Choose a different file" : "Choose a CSV file"}
          </Button>
          {fileName && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="size-4" aria-hidden /> {fileName}</p>}
          {fileError && <p role="alert" className="mt-3 text-sm font-medium text-danger">{fileError}</p>}
        </li>

        {rows.length > 0 && (
          <li className="rounded-card border bg-surface p-5 md:p-6">
            <h2 className="font-sans text-base font-semibold tracking-normal">3. Check and import</h2>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {good.length} of {rows.length} rows are ready{rows.length - good.length > 0 ? `. Fix the others in your file and upload it again, or import the ready ones now.` : "."}
            </p>
            <div className="mt-4 max-h-96 overflow-auto rounded-control border">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="sticky top-0 bg-surface-sunken text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2 font-medium">Line</th><th className="px-3 py-2 font-medium">Title</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Price</th><th className="px-3 py-2 font-medium">Result</th></tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.line}>
                      <td className="px-3 py-2 font-mono text-xs">{r.line}</td>
                      <td className="max-w-56 truncate px-3 py-2">{r.title || "—"}</td>
                      <td className="px-3 py-2 capitalize">{r.values?.fulfilment ?? ""}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.values ? formatMoney(r.values.price) : ""}</td>
                      <td className={r.error ? "px-3 py-2 text-danger" : "px-3 py-2 text-success"}>{r.error ?? "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" className="mt-4" disabled={busy || good.length === 0} onClick={() => void run()}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {busy ? `Adding ${done} of ${good.length}…` : `Import ${good.length} product${good.length === 1 ? "" : "s"}`}
            </Button>
          </li>
        )}
      </ol>

      {result && (
        <section role="status" className="mt-6 rounded-card border bg-surface p-5 md:p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">{result.made} added as drafts</h2>
          {result.stopped && <p className="mt-1 text-sm text-danger">{result.stopped}</p>}
          {result.failed.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-danger">
              {result.failed.map((f) => <li key={f.line}>Line {f.line} ({f.title}): {f.message}</li>)}
            </ul>
          )}
          <Button asChild className="mt-4"><Link href="/catalog/products">See your products</Link></Button>
        </section>
      )}
      {created.length > 0 && <FinishDrafts items={created} collections={collections} onChange={setCreated} />}
    </>
  );
}
