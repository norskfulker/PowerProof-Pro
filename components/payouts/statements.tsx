"use client";

import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Order, Payout } from "@/lib/types";

function monthsBack(n: number) {
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ key: start.toISOString().slice(0, 7), label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), start, end });
  }
  return out;
}

function download(name: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}

/** Monthly statements built from orders and payouts (CSV for the accountant). */
export function Statements({ orders, payouts }: { orders: Order[]; payouts: Payout[] }) {
  return (
    <ul className="divide-y rounded-card border bg-surface">
      {monthsBack(3).map((m) => {
        const inMonth = (iso?: string) => !!iso && new Date(iso) >= m.start && new Date(iso) < m.end;
        const os = orders.filter((o) => inMonth(o.paidAt) && (o.status === "paid" || o.status === "refunded" || o.status === "refund_requested"));
        const ps = payouts.filter((p) => inMonth(p.createdAt));
        return (
          <li key={m.key} className="flex items-center gap-4 px-5 py-4">
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{m.label}</span>
              <span className="block text-sm text-muted-foreground">{os.length} sales · {ps.length} payouts</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                download(`powerproof-statement-${m.key}.csv`, [
                  ["Type", "Date", "Reference", "Description", "Gross INR", "Fees INR", "Net INR"],
                  ...os.map((o) => ["Sale", o.paidAt ?? "", o.number, o.productTitle, (o.total.amount / 100).toFixed(2), ((o.fees.gateway.amount + o.fees.platform.amount) / 100).toFixed(2), (o.net.amount / 100).toFixed(2)]),
                  ...ps.map((p) => ["Payout", p.createdAt, p.reference ?? p.id, p.methodLabel, "", "", (-p.amount.amount / 100).toFixed(2)]),
                ]);
                toast.success("Statement downloaded", { description: m.label });
              }}
            >
              Download CSV
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
