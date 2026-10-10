"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Minus, Plus } from "lucide-react";
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
import { INDIAN_STATES } from "@/lib/india";
import { getQuote, type Quote, type StoreProduct } from "@/lib/api";
import { formatMoney, money } from "@/lib/money";
import { COD_COUNTRY, type ShippingSettings } from "@/lib/shipping";

/** One thing in the cart: a product, its option (when it has them) and how many */
export interface CartLine {
  product: StoreProduct;
  variantId?: string;
  quantity: number;
}

/** What the server says the order comes to, for orders with something to ship */
type ServerQuote = { ok: true; subtotal: number; discount: number; shipping: number; codFee: number; total: number; physical: boolean; coupon?: { ok: boolean; message: string } } | { ok: false; message: string };

const variantOf = (l: CartLine) => l.product.variants?.find((v) => v.id === l.variantId);
const unitOf = (l: CartLine) => variantOf(l)?.price ?? l.product.info.price;
/** How many can still be bought: the variant's (or product's) stock when it's counted */
export const leftOf = (p: StoreProduct, variantId?: string): number | undefined => {
  if (p.fulfilment !== "physical" || !p.trackStock) return undefined;
  return p.variants?.length ? p.variants.find((v) => v.id === variantId)?.stock ?? 0 : p.stock ?? 0;
};

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

type Reply =
  | { ok: false; message: string }
  | { ok: true; free: true; orderId: string; token: string }
  | { ok: true; free: false; cod: true; orderId: string; token: string }
  | { ok: true; free: false; cod?: undefined; orderId: string; keyId: string; gatewayOrderId: string; amount: number; currency: string; storeName: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, message: "Something went wrong. Please try again." }))) as T;
}

/**
 * Buy: the products in a short list, the buyer's details, then Razorpay's own window for the
 * payment. The price is worked out on the server and the order is confirmed only by Razorpay's
 * signed proof, so nothing here can be used to pay less.
 */
export function CheckoutSheet({ open, onOpenChange, storeId, storeSlug, lines, onLines, shipping, sellerName }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string; storeSlug: string; lines: CartLine[]; onLines: (l: CartLine[]) => void; shipping?: ShippingSettings; /** The store's invoice name: who the buyer is buying from */ sellerName?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", dial: "+91", phone: "", country: "IN", coupon: "", consent: false });
  const [addr, setAddr] = useState({ line1: "", line2: "", city: "", state: "", pincode: "" });
  const [payWith, setPayWith] = useState<"online" | "cod">("online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const products = lines.map((l) => l.product);
  const physical = products.some((p) => p.fulfilment === "physical");
  const allPhysical = products.every((p) => p.fulfilment === "physical");
  const codOffered = !!shipping?.cod.enabled && allPhysical && f.country === COD_COUNTRY;
  const method = codOffered ? payWith : "online";
  const listed = lines.reduce((t, l) => t + unitOf(l).amount * l.quantity, 0);
  const cur = products[0]?.info.price.currency ?? "INR";
  const askLines = lines.map((l) => ({ productId: l.product.id, variantId: l.variantId, quantity: l.quantity }));

  // Downloads: deals and the code worked out from the database as the code is typed
  const key = `${products.map((p) => p.id).join(",")}|${f.coupon.trim().toUpperCase()}`;
  const [fetched, setFetched] = useState<{ key: string; q: Quote }>();
  useEffect(() => {
    if (!open || !products.length || physical) return;
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

  // Shipped orders: the server prices shipping, cash on delivery, stock and the code together
  const skey = `${JSON.stringify(askLines)}|${f.coupon.trim().toUpperCase()}|${f.country}|${method}`;
  const [served, setServed] = useState<{ key: string; q: ServerQuote }>();
  useEffect(() => {
    if (!open || !physical) return;
    let alive = true;
    const t = setTimeout(() => {
      post<ServerQuote>("/api/checkout/quote", { storeSlug, productIds: [...new Set(products.map((p) => p.id))], lines: askLines, coupon: f.coupon.trim() || undefined, country: f.country, cod: method === "cod" })
        .then((q) => alive && setServed({ key: skey, q }))
        .catch(() => undefined);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, skey, storeSlug]); // eslint-disable-line react-hooks/exhaustive-deps
  const sq = served?.key === skey ? served.q : undefined;
  const quote: Quote | undefined = physical
    ? sq?.ok
      ? { currency: cur, subtotal: sq.subtotal, dealSaving: 0, codeOff: sq.discount, total: sq.total, coupon: sq.coupon }
      : undefined
    : fetched?.key === key
      ? fetched.q
      : undefined;
  const blocked = physical && sq && !sq.ok ? sq.message : undefined;
  const total = quote?.total ?? listed;
  const money$ = (n: number) => money(n, cur);
  const setLine = (i: number, patch: Partial<CartLine>) => onLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const digits = f.phone.replace(/\D/g, "");
    const rule = DIAL_CODES.find((d) => d.code === f.dial)!;
    if (f.name.trim().length < 2) return setError("Enter your full name for the receipt.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError("That email looks off. We send your files there, so check it.");
    if (digits.length < rule.min || digits.length > rule.max) return setError(`${rule.country} numbers are ${rule.min === rule.max ? rule.min : `${rule.min} to ${rule.max}`} digits.`);
    if (physical) {
      if (lines.some((l) => l.product.variants?.length && !l.variantId)) return setError("Pick an option for each item.");
      if (addr.line1.trim().length < 3) return setError("Enter the street address for delivery.");
      if (addr.city.trim().length < 2) return setError("Enter the city.");
      if (f.country === "IN" && !/^[1-9]\d{5}$/.test(addr.pincode.trim())) return setError("Indian PIN codes are 6 digits.");
      if (f.country !== "IN" && addr.pincode.trim().length < 3) return setError("Enter the postal code.");
      if (f.country === "IN" && !addr.state) return setError("Pick the state.");
      if (blocked) return setError(blocked);
    }
    if (!f.consent) return setError("Please accept the terms and refund policy to continue.");
    if (quote?.coupon && !quote.coupon.ok) return setError(`${quote.coupon.message} Fix or clear the code to continue.`);
    setBusy(true);
    setError(undefined);
    try {
      const reply = await post<Reply>("/api/checkout", {
        storeSlug,
        productIds: [...new Set(products.map((p) => p.id))],
        ...(physical ? { lines: askLines, shipTo: { name: f.name.trim(), phone: `${f.dial}${digits}`, ...addr, country: f.country }, paymentMethod: method } : {}),
        coupon: f.coupon.trim() || undefined,
        buyer: { name: f.name, email: f.email, phone: `${f.dial}${digits}`, country: f.country, consent: true },
      });
      if (!reply.ok) {
        setError(reply.message);
        return setBusy(false);
      }
      gtagEvent("begin_checkout", { currency: cur, value: total / 100, items: products.map((p) => ({ item_id: p.id, item_name: p.title, price: p.info.price.amount / 100 })) });
      if (reply.free || reply.cod) return router.push(`/success/${reply.orderId}?t=${reply.token}`);
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
          <SheetDescription>{physical ? (allPhysical ? "We'll email you when it's on its way." : "Your files arrive straight after; the rest is shipped to you.") : "Pay securely. Your files arrive straight after, and by email."}</SheetDescription>
        </SheetHeader>
        <form noValidate onSubmit={pay} className="flex flex-col gap-4 px-4 pb-6">
          <ul className="flex flex-col divide-y rounded-control border" aria-label="In your order">
            {lines.map((l, i) => {
              const p = l.product;
              const left = leftOf(p, l.variantId);
              return (
                <li key={`${p.id}-${l.variantId ?? i}`} className="flex flex-col gap-2 px-3 py-2.5 text-sm">
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{p.title}</span>
                    <MoneyText value={money$(unitOf(l).amount * l.quantity)} className="shrink-0" />
                  </span>
                  {p.fulfilment === "physical" && (
                    <span className="flex flex-wrap items-center gap-2">
                      {!!p.variants?.length && (
                        <Select value={l.variantId ?? ""} onValueChange={(variantId) => setLine(i, { variantId, quantity: Math.min(l.quantity, Math.max(1, leftOf(p, variantId) ?? 99)) })}>
                          <SelectTrigger size="sm" className="h-9 min-w-32" aria-label={`Option for ${p.title}`}><SelectValue placeholder={p.options?.map((o) => o.name).join(" / ") || "Pick one"} /></SelectTrigger>
                          <SelectContent>
                            {p.variants.map((v) => {
                              const out = p.trackStock && (v.stock ?? 0) <= 0;
                              return <SelectItem key={v.id} value={v.id} disabled={out}>{v.title}{out ? " (sold out)" : ""}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      )}
                      <span className="inline-flex items-center rounded-control border" role="group" aria-label={`How many ${p.title}`}>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="One fewer" disabled={l.quantity <= 1} onClick={() => setLine(i, { quantity: l.quantity - 1 })}><Minus /></Button>
                        <span className="min-w-8 text-center font-mono" aria-live="polite">{l.quantity}</span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="One more" disabled={l.quantity >= Math.min(99, left ?? 99)} onClick={() => setLine(i, { quantity: l.quantity + 1 })}><Plus /></Button>
                      </span>
                      {left !== undefined && left <= 5 && left > 0 && <span className="text-xs font-medium text-warning-ink">Only {left} left</span>}
                    </span>
                  )}
                </li>
              );
            })}
            {quote ? (
              <>
                {quote.dealSaving > 0 && <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-success"><span>Deal savings</span><span>−<MoneyText value={money$(quote.dealSaving)} /></span></li>}
                {quote.codeOff > 0 && <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-success"><span>{physical ? "Deals and code" : "Discount code"}</span><span>−<MoneyText value={money$(quote.codeOff)} /></span></li>}
                {physical && sq?.ok && <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>Shipping</span>{sq.shipping ? <MoneyText value={money$(sq.shipping)} /> : <span className="font-medium text-success">Free</span>}</li>}
                {physical && sq?.ok && sq.codFee > 0 && <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>Cash on delivery charge</span><MoneyText value={money$(sq.codFee)} /></li>}
              </>
            ) : null}
            <li className="flex items-center justify-between gap-3 bg-surface-sunken px-3 py-2.5 text-sm font-semibold">
              <span>{quote ? (method === "cod" ? "To pay on delivery" : "Total to pay") : blocked ? "Total" : physical ? "Total (working out shipping…)" : "Total (deals and codes are being worked out)"}</span>
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
          {physical && (
            <fieldset className="flex flex-col gap-3 rounded-control border p-3">
              <legend className="px-1 text-sm font-semibold">Delivery address</legend>
              <div className="flex flex-col gap-1.5"><Label htmlFor="co-a1">Street address</Label><Input id="co-a1" autoComplete="address-line1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="co-a2">Flat, landmark <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="co-a2" autoComplete="address-line2" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="co-city">City</Label><Input id="co-city" autoComplete="address-level2" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="co-pin">{f.country === "IN" ? "PIN code" : "Postal code"}</Label><Input id="co-pin" inputMode={f.country === "IN" ? "numeric" : undefined} autoComplete="postal-code" value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="co-state">State{f.country !== "IN" && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
                {f.country === "IN" ? (
                  <Select value={addr.state} onValueChange={(state) => setAddr({ ...addr, state })}>
                    <SelectTrigger id="co-state" className="w-full"><SelectValue placeholder="Pick your state" /></SelectTrigger>
                    <SelectContent>{INDIAN_STATES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input id="co-state" autoComplete="address-level1" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">We use your name and phone above for the courier.</p>
            </fieldset>
          )}
          {codOffered && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">How you&apos;ll pay</legend>
              {(
                [
                  ["online", "Pay online now", "UPI, cards, netbanking."],
                  ["cod", "Cash on delivery", shipping?.cod.fee ? `Pay the courier in cash. ${formatMoney(money$(shipping.cod.fee))} extra.` : "Pay the courier in cash."],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="co-pay" value={v} checked={payWith === v} onChange={() => setPayWith(v)} className="mt-1 accent-[var(--primary)]" />
                  <span className="flex flex-col"><span className="font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex flex-col gap-1.5"><Label htmlFor="co-code">Discount code <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="co-code" className="font-mono uppercase" autoComplete="off" aria-describedby="co-code-note" aria-invalid={quote?.coupon?.ok === false || undefined} value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value })} />
            <p id="co-code-note" role="status" aria-live="polite" className={quote?.coupon ? (quote.coupon.ok ? "text-sm font-medium text-success" : "text-sm font-medium text-danger") : "sr-only"}>
              {f.coupon.trim() ? (quote?.coupon ? (quote.coupon.ok ? `${quote.coupon.message} You save ${formatMoney(money$(quote.codeOff))}.` : quote.coupon.message) : "Checking the code…") : ""}
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <Checkbox checked={f.consent} onCheckedChange={(v) => setF({ ...f, consent: v === true })} className="mt-0.5" />
            <span>I accept the store&apos;s terms and refund policy.</span>
          </label>
          {sellerName && (
            <p className="rounded-control bg-surface-sunken px-3 py-2 text-xs text-muted-foreground" data-slot="seller">
              Sold by <span className="font-semibold text-foreground">{sellerName}</span>. Your {method === "cod" ? "order confirmation" : "receipt and invoice"} will be emailed to{" "}
              {/^\S+@\S+\.\S+$/.test(f.email.trim()) ? <span className="font-medium text-foreground [overflow-wrap:anywhere]">{f.email.trim()}</span> : "the email above"}.
            </p>
          )}
          {(error || blocked) && <p role="alert" className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error ?? blocked}</p>}
          <Button type="submit" size="lg" disabled={busy || !!blocked} className="w-full">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />} {busy ? (method === "cod" ? "Placing your order…" : "Opening payment…") : method === "cod" ? "Place order" : "Pay securely"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
