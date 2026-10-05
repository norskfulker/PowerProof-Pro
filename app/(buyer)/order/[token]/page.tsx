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
import { QuestionThread } from "@/components/pp/question-thread";
import { ReviewForm } from "@/components/pp/review-form";
import { ReviewItem } from "@/components/pp/review-item";
import { useApi } from "@/hooks/use-api";
import { answerAsBuyer, getOrderByToken, recordDownload, submitReview } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/money";
import type { ProductFile } from "@/lib/types";

/** Mock download: a small text file standing in for a signed, expiring link. */
function saveMock(file: ProductFile, orderNumber: string) {
  const blob = new Blob([`PowerProof demo download\nOrder ${orderNumber}\nFile: ${file.name}\n\nIn production this is a signed, expiring link to the real file.`], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${file.name}.txt`;
  a.click();
}

/** The secure order page buyers open from their email: files, invoice, reviews, refunds. */
export default function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data, error, reload } = useApi(() => getOrderByToken(token), [token], { live: true });
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<Set<string>>(new Set());

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;
  const { order, store, design, products, reviewable, myReviews, questions } = data;
  const creator = store.ownerName.split(" ")[0];

  if (order.status === "refunded" || order.status === "pending" || order.status === "failed") {
    return (
      <BuyerShell store={store} theme={design.theme} narrow>
        <title>Order unavailable</title>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted"><Lock className="size-6 text-muted-foreground" aria-hidden /></span>
          <h1 className="text-[1.75rem]">{order.status === "refunded" ? "This order was refunded." : "This order isn't paid yet."}</h1>
          <p className="max-w-sm text-muted-foreground">{order.status === "refunded" ? "Downloads stop when the money goes back." : "Finish paying and the download unlocks straight away."}</p>
          {order.status !== "refunded" && <Button asChild><Link href={`/checkout/${order.id}`}>Finish checkout</Link></Button>}
        </div>
      </BuyerShell>
    );
  }

  async function get(f: ProductFile) {
    setBusy(f.id);
    try {
      await recordDownload(token);
      saveMock(f, order.number);
      setDone((d) => new Set(d).add(f.id));
      toast.success("Download started", { description: f.name });
    } catch {
      toast.error("That didn't start. Try again in a moment.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <BuyerShell store={store} theme={design.theme} narrow>
      <title>{`Order ${order.number} · ${store.name}`}</title>
      <p className="eyebrow">Order {order.number} · paid {formatDate(order.paidAt ?? order.createdAt)}</p>
      <h1 className="mt-1 text-[1.875rem] leading-tight">Your files</h1>
      <p className="mt-1 text-muted-foreground">Bookmark this page. It&apos;s private to you and works on any device.</p>

      <ul className="mt-6 flex flex-col gap-4">
        {products.map((p) => (
          <li key={p.id} className="rounded-card border bg-surface">
            <div className="flex items-center gap-3 border-b p-4">
              <ProductImageView image={p.images[0]} size="xs" className="w-16 shrink-0" />
              <p className="min-w-0 flex-1 font-semibold">{p.title}</p>
            </div>
            <ul className="divide-y">
              {p.files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.name}</span><span className="font-mono text-xs text-muted-foreground">{formatBytes(f.size)}</span></span>
                  <Button onClick={() => get(f)} disabled={busy === f.id} variant={done.has(f.id) ? "secondary" : "primary"} className="max-sm:w-full">
                    {busy === f.id ? <Loader2 className="animate-spin" aria-hidden /> : done.has(f.id) ? <Check aria-hidden /> : <Download aria-hidden />}
                    {done.has(f.id) ? "Download again" : "Download"}
                  </Button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm"><Link href={`/invoice/${order.id}`} target="_blank">Tax invoice</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href={`/s/${store.slug}/contact`}>Need help?</Link></Button>
        <RefundRequest order={order} store={store} onDone={() => reload()} />
      </div>

      <section id="review" aria-labelledby="rev-h" className="mt-12 scroll-mt-20">
        <h2 id="rev-h" className="text-2xl">Your reviews</h2>
        <p className="mt-1 text-sm text-muted-foreground">Only verified buyers can review. It helps {creator} and the next person deciding.</p>
        <div className="mt-4 flex flex-col gap-4">
          {reviewable.map((pid) => {
            const p = products.find((x) => x.id === pid)!;
            return (
              <div key={pid} className="rounded-card border bg-surface p-5">
                <ReviewForm
                  idPrefix={`rf-${pid}`}
                  productTitle={p.title}
                  onSubmit={async (d) => {
                    await submitReview(token, { productId: pid, ...d });
                    toast.success("Review posted", { description: "Thank you. It's live on the product page." });
                  }}
                />
              </div>
            );
          })}
          {myReviews.length > 0 && (
            <div className="rounded-card border bg-surface px-5">
              {myReviews.map((r) => <ReviewItem key={r.id} review={r} creatorName={creator} productTitle={products.find((p) => p.id === r.productId)?.title} />)}
            </div>
          )}
          {reviewable.length === 0 && myReviews.length === 0 && <p className="text-sm text-muted-foreground">Reviews open once your order is paid.</p>}
        </div>
      </section>

      {questions.length > 0 && (
        <section aria-labelledby="qa-h" className="mt-12">
          <h2 id="qa-h" className="text-2xl">Help other buyers</h2>
          <p className="mt-1 text-sm text-muted-foreground">You bought it, so you can answer questions about it.</p>
          <div className="mt-4 rounded-card border bg-surface px-5">
            {questions.map((q) => (
              <QuestionThread key={q.id} question={q} answerLabel="Answer as a verified buyer" onAnswer={async (body) => { await answerAsBuyer(token, q.id, body); toast.success("Answer posted"); }} />
            ))}
          </div>
        </section>
      )}
      <TrustBar refundDays={store.refundDays} className="mt-10" />
    </BuyerShell>
  );
}
