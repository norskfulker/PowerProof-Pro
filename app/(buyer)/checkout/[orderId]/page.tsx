"use client";

import { use, useEffect, useState } from "react";
import { DealPanel } from "@/components/pp/deal-panel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { BuyerShell, ConversionNote, TrustBar } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { CheckoutSummary, CouponField } from "@/components/buyer/checkout-summary";
import { MockGateway } from "@/components/buyer/mock-gateway";
import { CheckoutForm, type CheckoutValues } from "@/components/pp/checkout-form";
import { MobilePayBar } from "@/components/pp/mobile-pay-bar";
import { OrderBump } from "@/components/pp/order-bump";
import { useApi } from "@/hooks/use-api";
import { applyCoupon, getCheckout, payOrder, removeCoupon, setOrderBump, trackDealViews, updateDeals } from "@/lib/api";
import { checkoutLines } from "@/lib/pricing";
import { localPrice } from "@/lib/money";

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { data, error, reload, setData } = useApi(() => getCheckout(orderId), [orderId]);
  const [values, setValues] = useState<CheckoutValues>();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string>();
  const [bumpPending, setBumpPending] = useState(false);
  const [dealPending, setDealPending] = useState(false);
  const [tracked, setTracked] = useState(false);

  const paid = data?.order.status === "paid";
  useEffect(() => {
    if (paid) router.replace(`/success/${orderId}`);
  }, [paid, orderId, router]);

  // One view per checkout visit for each rule the panel offers (stats for the creator)
  const offeredKey = data?.deals && !data.deals.skipped ? [...new Set(data.deals.offers.map((o) => o.ruleId))].join(",") : "";
  useEffect(() => {
    if (tracked || !offeredKey) return;
    const t = setTimeout(() => {
      setTracked(true);
      trackDealViews(orderId, offeredKey.split(",")).catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [tracked, offeredKey, orderId]);

  async function changeDeals(change: Parameters<typeof updateDeals>[1]) {
    setDealPending(true);
    try {
      setData(await updateDeals(orderId, change));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setDealPending(false);
    }
  }

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;
  const { order, store, design, products, bump } = data;
  const intl = order.buyerTotal.currency !== "INR";
  const bumpOn = order.items.some((i) => i.kind === "bump");
  const firstProduct = products.find((p) => p.id === order.productId);

  async function claimFree(v: CheckoutValues) {
    setPaying(true);
    setPayError(undefined);
    try {
      await payOrder({ orderId, name: v.name, email: v.email, phone: `${v.dial} ${v.phone}`, method: v.method, free: true });
      router.push(`/success/${orderId}`);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "That didn't go through. Try again.");
      setPaying(false);
    }
  }

  async function pay(fail: boolean) {
    if (!values) return;
    setPaying(true);
    setPayError(undefined);
    try {
      await payOrder({ orderId, name: values.name, email: values.email, phone: `${values.dial} ${values.phone}`, method: values.method, simulateFailure: fail });
      router.push(`/success/${orderId}`);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "The payment didn't go through.");
      setValues(undefined);
      setPaying(false);
    }
  }

  return (
    <BuyerShell store={store} theme={design.theme} bottomBar>
      <title>{`Checkout · ${order.productTitle}`}</title>
      {firstProduct && (
        <Link href={`/s/${store.slug}/${firstProduct.slug}`} className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Back to product
        </Link>
      )}
      <h1 className="text-[2rem]">Checkout</h1>
      <p className="mt-1 text-muted-foreground">One step. Your files arrive the moment you pay.</p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="order-2 flex flex-col gap-5 lg:order-1">
          <FormError message={payError} />
          <CheckoutForm
            key={intl ? "intl" : "in"}
            international={intl}
            total={order.buyerTotal}
            termsHref={`/s/${store.slug}/policies/terms`}
            refundHref={`/s/${store.slug}/policies/refund`}
            couponSlot={
              <CouponField
                applied={order.couponCode}
                onApply={async (code) => {
                  const v = await applyCoupon(orderId, code);
                  setData(v);
                  toast.success("Code applied");
                }}
                onRemove={async () => setData(await removeCoupon(orderId))}
              />
            }
            pending={paying}
            onPay={(v) => (order.buyerTotal.amount === 0 ? claimFree(v) : setValues(v))}
          />
          <TrustBar refundDays={store.refundDays} />
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2 lg:self-start">
          <CheckoutSummary order={order} products={[...products, ...(bump ? [bump.product] : []), ...(data.deals?.products ?? [])]} />
          {data.deals && (
            <DealPanel
              deals={data.deals}
              items={order.items}
              added={order.dealAdds ?? []}
              giftChoices={order.giftChoices}
              currency={order.buyerTotal.currency}
              busy={dealPending}
              onAdd={(ids) => ids.reduce((p, id) => p.then(() => changeDeals({ add: id })), Promise.resolve())}
              onRemove={(id) => changeDeals({ remove: id })}
              onGift={(ruleId, productId) => changeDeals({ gift: { ruleId, productId } })}
              onSkip={(skip) => changeDeals({ skip })}
            />
          )}
          {intl && <ConversionNote currency={order.buyerTotal.currency} />}
          {bump && (
            <OrderBump
              label={bump.label}
              description="Add it now and get it in the same download. One tap, no second checkout."
              image={bump.product.images[0]}
              price={localPrice(bump.price, order.buyerTotal.currency)}
              checked={bumpOn}
              disabled={bumpPending}
              onChange={async (on) => {
                setBumpPending(true);
                try {
                  setData(await setOrderBump(orderId, on));
                } finally {
                  setBumpPending(false);
                }
              }}
            />
          )}
        </aside>
      </div>

      <MobilePayBar total={order.buyerTotal} pending={paying} savings={(() => { const l = checkoutLines(order); return { ...l.dealSaving, amount: l.dealSaving.amount + l.discount.amount }; })()} />

      <MockGateway
        open={!!values}
        onOpenChange={(o) => !o && setValues(undefined)}
        amount={order.buyerTotal}
        method={values?.method ?? "upi"}
        pending={paying}
        onApprove={() => pay(false)}
        onDecline={() => pay(true)}
      />
    </BuyerShell>
  );
}
