import { CheckCircle2, CircleDashed, Download, Mail, RotateCcw, ShoppingCart, XCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  at?: string;
  tone: "done" | "pending" | "bad";
}

function stepsFor(o: Order): Step[] {
  const s: Step[] = [{ icon: ShoppingCart, title: "Checkout started", at: o.createdAt, tone: "done", body: `${o.country}` }];
  if (o.status === "failed") {
    s.push({ icon: XCircle, title: "Payment failed", body: "The bank declined it. No money moved.", tone: "bad" });
    return s;
  }
  if (o.status === "pending") {
    s.push({ icon: CircleDashed, title: "Waiting for payment", body: "Buyer hasn't finished paying.", tone: "pending" });
    return s;
  }
  s.push({ icon: CheckCircle2, title: `Paid by ${o.paymentMethod.toUpperCase()}`, at: o.paidAt, tone: "done" });
  s.push({ icon: Mail, title: "Receipt and download link emailed", body: o.buyerEmail, at: o.paidAt, tone: "done" });
  s.push({
    icon: Download,
    title: o.downloads ? `Downloaded ${o.downloads} time${o.downloads === 1 ? "" : "s"}` : "Not downloaded yet",
    tone: o.downloads ? "done" : "pending",
  });
  if (o.status === "refund_requested") s.push({ icon: RotateCcw, title: "Refund requested", body: o.refundReason, tone: "pending" });
  if (o.status === "refunded") s.push({ icon: RotateCcw, title: "Refunded", body: o.refundReason, at: o.refundedAt, tone: "bad" });
  return s;
}

export function OrderTimeline({ order }: { order: Order }) {
  return (
    <ol className="mt-4 flex flex-col">
      {stepsFor(order).map((st, i, arr) => (
        <li key={st.title} className="relative flex gap-4 pb-5 last:pb-0">
          {i < arr.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border-strong" aria-hidden />}
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full",
              st.tone === "done" && "bg-success-soft text-success",
              st.tone === "pending" && "bg-muted text-muted-foreground",
              st.tone === "bad" && "bg-danger-soft text-danger"
            )}
          >
            <st.icon className="size-4" aria-hidden />
          </span>
          <div className="pt-1">
            <p className="text-sm font-semibold">{st.title}</p>
            {st.body && <p className="text-sm text-muted-foreground">{st.body}</p>}
            {st.at && <p className="font-mono text-[0.6875rem] text-muted-foreground">{formatDate(st.at, { time: true })}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
