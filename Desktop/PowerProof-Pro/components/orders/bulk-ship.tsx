"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fulfilOrder } from "@/lib/api";
import type { Order } from "@/lib/types";

/** "1042, AWB123" or "PP-1042 AWB123" per line: order number, then its tracking number */
function parsePasted(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const [ref, number] = line.split(/[,\t;]|\s+/).map((x) => x.trim()).filter(Boolean);
    if (ref && number) out.set(ref.toLowerCase().replace(/^#/, ""), number);
  }
  return out;
}

/**
 * Mark several orders as shipped at once: one courier for all, a tracking number for each (typed,
 * or pasted from the courier's sheet), and an email to each buyer. Orders that can't be shipped
 * are left out and named. Mount it with a new key each time it opens so it starts empty.
 */
export function BulkShip({ orders, open, onOpenChange, onDone }: { orders: Order[]; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const ready = orders.filter((o) => o.fulfilment === "unfulfilled" && (o.status === "paid" || o.status === "cod"));
  const [carrier, setCarrier] = useState("");
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [pasted, setPasted] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  function applyPasted(text: string) {
    setPasted(text);
    const map = parsePasted(text);
    if (!map.size) return;
    setNumbers((cur) => {
      const next = { ...cur };
      for (const o of ready) {
        const n = map.get(o.number.toLowerCase()) ?? map.get(o.number.toLowerCase().replace(/^[a-z]+-/, ""));
        if (n) next[o.id] = n;
      }
      return next;
    });
  }

  async function ship() {
    setBusy(true);
    const failed: string[] = [];
    for (const o of ready) {
      try {
        await fulfilOrder(o.id, { step: "shipped", carrier: carrier.trim() || undefined, number: numbers[o.id]?.trim() || undefined, notify });
      } catch (e) {
        failed.push(`${o.number}: ${e instanceof Error ? e.message : "didn't save"}`);
      }
    }
    setBusy(false);
    const ok = ready.length - failed.length;
    if (ok) toast.success(`${ok} order${ok === 1 ? "" : "s"} marked as shipped`, { description: notify ? "Each buyer gets an email with their tracking." : undefined });
    if (failed.length) toast.error(`${failed.length} couldn't be shipped`, { description: failed.slice(0, 3).join(" · ") });
    onDone();
    if (!failed.length) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Mark {ready.length} as shipped</SheetTitle>
          <SheetDescription>
            {orders.length > ready.length ? `${orders.length - ready.length} of the selected orders can't be shipped (already sent, refunded or not physical) and are left out.` : "One courier for all of them, and a tracking number for each."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-carrier">Courier</Label>
            <Input id="bulk-carrier" placeholder="Delhivery, India Post, Blue Dart…" maxLength={60} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-paste">Paste from the courier (optional)</Label>
            <Textarea id="bulk-paste" size="sm" placeholder={"One per line: order number, tracking number\nPP-1042, AWB123456"} value={pasted} onChange={(e) => applyPasted(e.target.value)} />
          </div>
          <ul className="flex flex-col gap-2" aria-label="Tracking numbers">
            {ready.map((o) => (
              <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3">
                <Label htmlFor={`trk-${o.id}`} className="flex min-w-0 flex-col items-start gap-0">
                  <span className="font-mono text-sm">{o.number}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{o.shipTo?.name ?? o.buyerName}{o.shipTo?.city ? `, ${o.shipTo.city}` : ""}</span>
                </Label>
                <Input id={`trk-${o.id}`} placeholder="Tracking number" maxLength={80} value={numbers[o.id] ?? ""} onChange={(e) => setNumbers({ ...numbers, [o.id]: e.target.value })} />
              </li>
            ))}
          </ul>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
            Email each buyer
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Email each buyer" />
          </label>
        </div>
        <SheetFooter>
          <Button onClick={() => void ship()} disabled={busy || !ready.length}>
            {busy && <Loader2 className="animate-spin" aria-hidden />} Mark {ready.length} as shipped
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
