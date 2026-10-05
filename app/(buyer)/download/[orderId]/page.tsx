"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Check, Download, FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BuyerShell, TrustBar } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { RefundRequest } from "@/components/buyer/refund-request";
import { ProductImageView } from "@/components/pp/product-cover";
import { useApi } from "@/hooks/use-api";
import { getDelivery, recordDownload } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/money";
import type { ProductFile } from "@/lib/types";

/** Mock download: a small text file standing in for the real signed URL. */
function saveMock(file: ProductFile, orderNumber: string) {
  const blob = new Blob([`PowerProof demo download\nOrder ${orderNumber}\nFile: ${file.name}\n\nIn production this is a signed, expiring link to the real file.`], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${file.name}.txt`;
  a.click();
}

export default function DownloadPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { data, error, reload, setData } = useApi(() => getDelivery(orderId), [orderId]);
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<Set<string>>(new Set());

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;
  const { order, product, store } = data;

  if (order.status === "refunded" || order.status === "pending" || order.status === "failed") {
    return (
      <BuyerShell store={store} narrow>
        <title>Download unavailable</title>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted"><Lock className="size-6 text-muted-foreground" aria-hidden /></span>
          <h1 className="text-[28px]">{order.status === "refunded" ? "This order was refunded." : "This order isn't paid yet."}</h1>
          <p className="max-w-sm text-muted-foreground">{order.status === "refunded" ? "Downloads stop when the money goes back. Questions? Write to the creator." : "Finish paying and the download unlocks straight away."}</p>
          {order.status !== "refunded" && <Button asChild><Link href={`/checkout/${order.id}`}>Finish checkout</Link></Button>}
        </div>
      </BuyerShell>
    );
  }

  async function get(f: ProductFile) {
    setBusy(f.id);
    try {
      await recordDownload(order.id);
      saveMock(f, order.number);
      setDone((d) => new Set(d).add(f.id));
      toast.success("Download started", { description: f.name });
    } catch {
      toast.error("That didn't start. Try again, or use the link in your email.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <BuyerShell store={store} narrow>
      <title>{`Download · ${product.title}`}</title>
      <div className="flex items-center gap-4">
        <ProductImageView image={product.images[0]} size="xs" className="w-24 shrink-0" />
        <div className="min-w-0">
          <p className="eyebrow">Delivered · {order.number}</p>
          <h1 className="mt-1 text-[26px] leading-tight">{product.title}</h1>
        </div>
      </div>

      <section aria-labelledby="files-h" className="mt-6 rounded-card border bg-surface">
        <h2 id="files-h" className="border-b px-4 py-3 font-sans text-base font-semibold tracking-normal">Your files</h2>
        {product.files.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{store.name} is adding the file. You&apos;ll get an email the moment it&apos;s ready.</p>
        ) : (
          <ul className="divide-y">
            {product.files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                </span>
                <Button onClick={() => get(f)} disabled={busy === f.id} variant={done.has(f.id) ? "secondary" : "primary"} className="max-sm:w-full">
                  {busy === f.id ? <Loader2 className="animate-spin" aria-hidden /> : done.has(f.id) ? <Check aria-hidden /> : <Download aria-hidden />}
                  {done.has(f.id) ? "Download again" : "Download"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-3 text-sm text-muted-foreground">
        Bookmark this page. Links refresh every time you open it, and the same page is in your email from {store.name}. Paid on {formatDate(order.paidAt ?? order.createdAt)}.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm"><Link href={`/invoice/${order.id}`} target="_blank">Tax invoice</Link></Button>
        <Button asChild variant="ghost" size="sm"><a href={`mailto:${store.supportEmail}?subject=Order ${order.number}`}>Get help</a></Button>
        <RefundRequest order={order} store={store} onDone={(o) => setData({ ...data, order: o })} />
      </div>
      <TrustBar refundDays={store.refundDays} className="mt-8" />
    </BuyerShell>
  );
}
