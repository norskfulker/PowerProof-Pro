"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { addOrderNote, getOrderEvents } from "@/lib/api";
import { timeAgo, formatDate } from "@/lib/format";
import type { Order, OrderEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL: Record<OrderEvent["kind"], string> = {
  paid: "Paid",
  shipped: "Marked as shipped",
  tracking: "Tracking updated",
  delivered: "Marked as delivered",
  cancelled: "Cancelled",
  cod_paid: "Cash collected",
  refund: "Refunded",
  receipt_resent: "Receipt sent again",
  note: "Note",
};

/**
 * Private notes on an order and a log of what was done to it, by whom. Only the store's team
 * sees this; the buyer never does.
 */
export function OrderActivity({ order }: { order: Pick<Order, "id" | "total"> }) {
  const { data, error, reload, setData } = useApi(() => getOrderEvents(order), [order.id], { live: true });
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const e = await addOrderNote(order, text);
      setData([...(data ?? []), e]);
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The note didn't save.");
    }
    setSaving(false);
  }

  return (
    <section className="rounded-card border bg-surface p-5 md:p-6" aria-labelledby="act-h">
      <h2 id="act-h" className="font-sans text-base font-semibold tracking-normal">Notes and activity</h2>
      <p className="text-xs text-muted-foreground">Only your team sees this.</p>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Textarea
          size="sm"
          aria-label="Add a note"
          placeholder="Add a note: a call with the buyer, a promised replacement…"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void add();
            }
          }}
        />
        <Button type="submit" size="sm" className="self-end" disabled={saving || !text.trim()}>
          {saving && <Loader2 className="animate-spin" aria-hidden />} Add note
        </Button>
      </form>
      {error ? (
        <p className="mt-4 text-sm text-danger">
          {error} <button type="button" className="underline" onClick={reload}>Try again</button>
        </p>
      ) : !data ? (
        <Skeleton className="mt-4 h-20" />
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing yet. Shipping, refunds, resent receipts and notes appear here.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3" aria-label="Activity">
          {[...data].reverse().map((e) => (
            <li key={e.id} className={cn("flex flex-col gap-0.5 border-l-2 pl-3", e.kind === "note" ? "border-accent" : "border-border")}>
              <p className="text-sm">
                <span className="font-medium">{LABEL[e.kind]}</span>
                {e.amount && e.kind === "refund" && <> <MoneyText value={e.amount} /></>}
                <span className="text-muted-foreground"> · {e.actorName ? (e.mine ? "you" : e.actorName) : "automatic"} · <time dateTime={e.createdAt} title={formatDate(e.createdAt)}>{timeAgo(e.createdAt)}</time></span>
              </p>
              {e.body && <p className={cn("text-sm whitespace-pre-line", e.kind === "note" ? "text-foreground" : "text-muted-foreground")}>{e.body}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
