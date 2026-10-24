"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import { chaserExportUrl, chaserOp, getLatestImport, type AgentInstance, type ImportSummary } from "@/lib/api/agents";
import { ImportPanel, ImportReport } from "./import-panel";
import { day, useChaser } from "./shared";

/** Add or refresh invoices, see the last upload's report, export everything, or delete it all */
export function UploadView({ instance }: { instance: AgentInstance }) {
  const last = useApi(getLatestImport, [], { live: true });
  const { derived } = useChaser();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const pending = last.data && last.data.status === "open" && last.data.missingInvoiceIds.length > 0 ? last.data : null;
  const pendingSummary: ImportSummary | null = pending
    ? { importId: pending.id, total: pending.rowsTotal, imported: pending.rowsImported, updated: pending.rowsUpdated, failed: pending.rowsFailed, markedPaid: 0, missing: pending.missingInvoiceIds
          .map((id) => derived?.invoices.find((i) => i.id === id && i.status === "open"))
          .filter((i) => !!i)
          .map((i) => ({ id: i.id, invoiceNo: i.invoiceNo, customer: derived?.customerById.get(i.customerId)?.name ?? "", outstandingMinor: i.totalMinor - i.paidMinor })), problems: [], warnings: [] }
    : null;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="add">
        <h2 id="add" className="text-xl">Add or refresh invoices</h2>
        <p className="text-sm text-muted-foreground">Upload your latest file any time: invoices are matched by number, so nothing is doubled.</p>
        <ImportPanel instance={instance} />
      </section>
      {last.data && (
        <section className="flex flex-col gap-2" aria-labelledby="last">
          <h2 id="last" className="text-xl">Last upload</h2>
          <p className="text-sm text-muted-foreground">
            {last.data.fileName || "Invoices"} · {day(last.data.createdAt.slice(0, 10))} · {last.data.rowsImported} new, {last.data.rowsUpdated} updated, {last.data.rowsFailed} skipped
          </p>
          {pendingSummary && pendingSummary.missing.length > 0 && <ImportReport summary={pendingSummary} onChanged={() => last.reload()} />}
        </section>
      )}
      <section className="flex flex-col gap-3 border-t pt-6" aria-labelledby="data">
        <h2 id="data" className="text-xl">Your data</h2>
        <Button variant="secondary" className="self-start" onClick={async () => window.location.assign(await chaserExportUrl())}>
          <Download aria-hidden /> Export my data (CSV)
        </Button>
        <div className="flex flex-col gap-2 rounded-card border border-danger/30 p-4">
          <p className="font-semibold">Delete all Payment Chaser data</p>
          <p className="text-sm text-muted-foreground">Every customer, invoice and reminder it holds for this store, and the agent itself. Type DELETE to unlock.</p>
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Type DELETE to unlock" placeholder="DELETE" className="max-w-40" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <Button variant="danger" disabled={typed !== "DELETE"} onClick={() => setConfirm(true)}>
              <Trash2 aria-hidden /> Delete everything
            </Button>
          </div>
        </div>
      </section>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete all Payment Chaser data?"
        description="This can't be undone. Export your data first if you may need it."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          try {
            await chaserOp({ op: "delete_all", confirm: "DELETE" });
            toast.success("Deleted.");
            router.replace("/agents/my");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't work.");
          }
        }}
      />
    </div>
  );
}
