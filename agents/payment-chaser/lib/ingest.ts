import type { AgentHooks } from "@/lib/server/agents/runtime/types";
import { saveInvoices } from "./import";
import { detectMapping, mappingProblems, parseSheet, MAX_ROWS, type Mapping } from "./parse";

/** Rows in (from an upload or the connected sheet), invoices saved: the same checks for every source */
export const ingest: NonNullable<AgentHooks["ingest"]> = async (db, rows, o) => {
  if (rows.length < 2) return { ok: false, message: "The file has no rows under the headers." };
  if (rows.length > MAX_ROWS + 1) return { ok: false, message: `Up to ${MAX_ROWS.toLocaleString("en-IN")} rows at a time. Split the file and upload each part.` };
  const mapping: Mapping = (o.mapping as Mapping | undefined) ?? detectMapping(rows[0]);
  const problems = mappingProblems(mapping);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const parsed = parseSheet(rows, mapping);
  if (!parsed.invoices.length) return { ok: false, message: "None of the rows could be read. Check the columns and try again.", summary: { problems: parsed.results.filter((r) => !r.ok).slice(0, 50) } };
  const summary = await saveInvoices(db, { invoices: parsed.invoices, results: parsed.results, source: o.source, fileName: o.fileName, isFull: o.isFull, now: o.now, userId: o.userId, newId: o.newId });
  return { ok: true, summary: { ...summary, duplicates: parsed.duplicates } };
};
