"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DIAL_CODES } from "@/components/pp/checkout-form";
import { gtagEvent } from "@/lib/analytics-tags";
import { COUNTRIES } from "@/lib/countries";
import { getQuote, type Quote, type StoreProduct } from "@/lib/api";
import { formatMoney, money } from "@/lib/money";

/** What the browser needs to open Razorpay's payment window */
interface RazorpayWindow {
  Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | undefined;
function loadRazorpay(): Promise<void> {
  const w = window as unknown as RazorpayWindow;
  if (w.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = undefined;
      reject(new Error("The payment window couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

type Reply = { ok: false; message: string } | { ok: true; free: true; orderId: string; token: string } | { ok: true; free: false; orderId: string; keyId: string; gatewayOrderId: string; amount: number; currency: string; storeName: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, message: "Something went wrong. Please try again." }))) as T;
}

/**
 * Buy: the products in a short list, the buyer's details, then Razorpay's own window for the
 * payment. The price is worked out on the server and the order is confirmed only by Razorpay's
 * signed proof, so nothing here can be used to pay less.
 */
export function CheckoutSheet({ open, onOpenChange, storeId, storeSlug, products }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string; storeSlug: string; products: StoreProduct[] }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", dial: "+91", phone: "", country: "IN", coupon: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const listed = products.reduce((t, p) => t + p.info.price.amount, 0);
  const cur = products[0]?.info.price.currency ?? "INR";

  // The total with deals and the discount code, worked out from the database as the code is typed
  const key = `${products.map((p) => p.id).join(",")}|${f.coupon.trim().toUpperCase()}`;
  const [fetched, setFetched] = useState<{ key: string; q: Quote }>();
  useEffect(() => {
    if (!open || !products.length) return;
    let alive = true;
    const t = setTimeout(() => {
      getQuote({ storeId, products: products.map((p) => ({ id: p.id, title: p.title, price: p.info.price })) }, f.coupon)
        .then((q) => alive && setFetched({ key, q }))
        .catch(() => undefined);
    }, f.coupon.trim() ? 400 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, key, storeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const quote = fetched?.key === key ? fetched.q : undefined;
  const total = quote?.total ?? listed;
  const money$ = (n: number) => money(n, cur);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const digits = f.phone.replace(/\D/g, "");
    const rule = DIAL_CODES.find((d) => d.code === f.dial)!;
    if (f.name.trim().length < 2) return setError("Enter your full name for the receipt.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError("That email looks off. We send your files there, so check it.");
    if (digits.length < rule.min || digits.length > rule.max) return setError(`${rule.country} numbers are ${rule.min === rule.max ? rule.min : `${rule.min} to ${rule.max}`} digits.`);
    if (!f.consent) return setError("Please accept the terms and refund policy to continue.");
    if (quote?.coupon && !quote.coupon.ok) return setError(`${quote.coupon.message} Fix or clear the code to continue.`);
    setBusy(true);
    setError(undefined);
    try {
      const reply = await post<Reply>("/api/checkout", { storeSlug, productIds: products.map((p) => p.id), coupon: f.coupon.trim() || undefined, buyer: { name: f.name, email: f.email, phone: `${f.dial}${digits}`, country: f.country, consent: true } });
      if (!reply.ok) {
        setError(reply.message);
        return setBusy(false);
      }
      gtagEvent("begin_checkout", { currency: cur, value: total / 100, items: products.map((p) => ({ item_id: p.id, item_name: p.title, price: p.info.price.amount / 100 })) });
      if (reply.free) return router.push(`/success/${reply.orderId}?t=${reply.token}`);
      await loadRazorpay();
      const Razorpay = (window as unknown as RazorpayWindow).Razorpay!;
      const rz = new Razorpay({
        key: reply.keyId,
        order_id: reply.gatewayOrderId,
        amount: reply.amount,
        currency: reply.currency,
        name: reply.storeName,
        description: products.length === 1 ? products[0].title : `${products.length} products`,
        prefill: { name: f.name, email: f.email.trim(), contact: `${f.dial}${digits}` },
        theme: { color: "#0F3D33" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const done = await post<{ ok: true; orderId: string; token: string } | { ok: false; message: string }>("/api/checkout/verify", { gatewayOrderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
          if (done.ok) router.push(`/success/${done.orderId}?t=${done.token}`);
          else {
            setError(done.message);
            setBusy(false);
          }
        },
      });
      rz.on("payment.failed", (r) => {
        setError(r.error?.description ?? "The payment didn't go through. You haven't been charged. Try again or use another method.");
        setBusy(false);
      });
      rz.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. You haven't been charged.");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (busy) return; if (o) setError(undefined); onOpenChange(o); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Checkout</SheetTitle>
          <SheetDescription>Pay securely. Your files arrive straight after, and by email.</SheetDescription>
        </SheetHeader>
        <form noValidate onSubmit={pay} className="flex flex-col gap-4 px-4 pb-6">
          <ul className="flex flex-col divide-y rounded-control border" aria-label="In your order">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{p.title}</span>
                <MoneyText value={p.info.price} className="shrink-0" />
              </li>
            ))}
            {quote ? (
              <>
                {quote.dealSaving > 0 && <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-success"><span>Deal savings</span><span>−<MoneyText value={money$(quote.dealSaving)} /></span></li>}
                {quote.codeOff > 0 && <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-success"><span>Discount code</span><span>−<MoneyText value={money$(quote.codeOff)} /></span></li>}
              </>
            ) : null}
            <li className="flex items-center justify-between gap-3 bg-surface-sunken px-3 py-2.5 text-sm font-semibold">
              <span>{quote ? "Total to pay" : "Total (deals and codes are being worked out)"}</span>
              <MoneyText value={money$(total)} />
            </li>
          </ul>

          <div className="flex flex-col gap-1.5"><Label htmlFor="co-name">Full name</Label><Input id="co-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="co-email">Email</Label><Input id="co-email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="co-dial">Code</Label>
              <Select value={f.dial} onValueChange={(dial) => setF({ ...f, dial })}>
                <SelectTrigger id="co-dial" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{DIAL_CODES.map((d) => <SelectItem key={d.code} value={d.code}>{d.code} {d.country}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="co-phone">Phone</Label><Input id="co-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="co-country">Country</Label>
            <Select value={f.country} onValueChange={(country) => setF({ ...f, country })}>
              <SelectTrigger id="co-country" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="co-code">Discount code <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="co-code" className="font-mono uppercase" autoComplete="off" aria-describedby="co-code-note" aria-invalid={quote?.coupon?.ok === false || undefined} value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value })} />
            <p id="co-code-note" role="status" aria-live="polite" className={quote?.coupon ? (quote.coupon.ok ? "text-sm font-medium text-success" : "text-sm font-medium text-danger") : "sr-only"}>
              {f.coupon.trim() ? (quote?.coupon ? (quote.coupon.ok ? `${quote.coupon.message} You save ${formatMoney(money$(quote.codeOff))}.` : quote.coupon.message) : "Checking the code…") : ""}
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <Checkbox checked={f.consent} onCheckedChange={(v) => setF({ ...f, consent: v === true })} className="mt-0.5" />
            <span>I accept the store&apos;s terms and refund policy.</span>
          </label>
          {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />} {busy ? "Opening payment…" : "Pay securely"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
