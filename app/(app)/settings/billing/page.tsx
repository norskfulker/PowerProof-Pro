"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Receipt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { usePlan } from "@/components/plan/plan-context";
import { PlanComparisonTable, PlanUsage } from "@/components/plan/plan-usage";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useApi } from "@/hooks/use-api";
import { getPlan } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatMoney, money } from "@/lib/money";

export default function BillingPage() {
  const { data, error, reload } = useApi(getPlan, [], { live: true });
  const planCtx = usePlan();
  const [billing, setBilling] = useState<{ tier: string; subscription: { id: string; status: string; trialEndsAt: string | null; currentEnd: string | null } | null; receipts: { id: string; amountMinor: number; currency: string; paymentId: string; createdAt: string }[] } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const loadBilling = useCallback(() => {
    fetch("/api/billing/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setBilling(j);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadBilling();
  }, [loadBilling]);
  if (!data) return <SettingsLoading error={error} onRetry={reload} />;
  const { plan } = data;
  const trial = plan.status === "trial";

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="Plan">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-2xl">{plan.name}</p>
              <StatusPill status={plan.status} />
            </div>
            <p className="mt-2 flex items-baseline gap-1.5">
              <MoneyText value={plan.monthly} className="font-display text-4xl" />
              <span className="text-muted-foreground">/ month</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Plus {plan.platformFeePct}% per sale. The gateway takes about {plan.gatewayFeePct}% on its own.</p>
          </div>
          {trial && plan.trialEndsAt ? (
            <div className="rounded-card border border-accent/40 bg-accent-soft p-4 md:w-72">
              <p className="flex items-center gap-2 font-semibold text-accent-ink"><Sparkles className="size-4" aria-hidden /> Free month</p>
              <p className="mt-1 text-sm">Until {formatDate(plan.trialEndsAt)}. Add a card before then so your store doesn&apos;t pause.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground md:w-72">Renews on the 1st. Fees for the month are billed with it.</p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Usage and limits"
        description={planCtx.state?.tier === "free" ? "Free includes one store, up to 10 products and 3 pages. You'll be asked before anything stops." : "Pro has no limits on stores or products."}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <PlanUsage tone="card" className="lg:w-72" />
          <div className="min-w-0 flex-1">
            <div className="overflow-x-auto rounded-card border">
              <PlanComparisonTable current={planCtx.state?.tier} />
            </div>
            {planCtx.state?.tier === "free" && (
              <Button className="mt-4" onClick={() => planCtx.upgrade()}>
                <Sparkles aria-hidden /> Upgrade to Pro, first month free
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Payment method" description="Cards are handled by Razorpay's secure page. PowerProof never sees the number.">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary"><CreditCard className="size-5" aria-hidden /></span>
          <span className="flex-1">
            {billing?.subscription ? (
              <><span className="block font-medium">Pro subscription {billing.subscription.status}</span><span className="block text-sm text-muted-foreground">{billing.subscription.trialEndsAt ? `Free trial until ${formatDate(billing.subscription.trialEndsAt)}. ` : ""}₹1,999/month after that. Cancel any time.</span></>
            ) : planCtx.state?.tier === "pro" ? (
              <><span className="block font-medium">Pro</span><span className="block text-sm text-muted-foreground">Subscription details are loading.</span></>
            ) : (
              <><span className="block font-medium">No subscription yet</span><span className="block text-sm text-muted-foreground">Your card is authorised when you upgrade; the first 30 days are free.</span></>
            )}
          </span>
          {planCtx.state?.tier === "free" ? (
            <Button variant="secondary" onClick={() => planCtx.upgrade()}>Upgrade to Pro</Button>
          ) : (
            <Button
              variant="secondary"
              disabled={cancelling || !billing?.subscription}
              onClick={async () => {
                setCancelling(true);
                const res = await fetch("/api/billing/status", { method: "DELETE" }).then((r) => r.json()).catch(() => ({ ok: false, message: "We couldn't reach the server." }));
                if (res.ok) {
                  toast.success("Pro cancelled. You're back on Free.");
                  loadBilling();
                  reload();
                } else {
                  toast.error(res.message ?? "We couldn't cancel that. Try again.");
                }
                setCancelling(false);
              }}
            >
              {cancelling ? "Cancelling…" : "Cancel Pro"}
            </Button>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Receipts" description="One receipt per monthly charge. Simple receipts, no GST invoice.">
        {!billing?.receipts.length ? (
          <EmptyState compact icon={Receipt} title="No receipts yet." body="Your first receipt appears here after the free trial, when the first ₹1,999 charge goes through." />
        ) : (
          <ul className="divide-y rounded-card border">
            {billing.receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">{formatMoney(money(r.amountMinor, (r.currency as "INR") || "INR"))}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{r.paymentId} · {formatDate(r.createdAt)}</span>
                </span>
                <span className="text-xs text-muted-foreground">Receipt</span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </div>
  );
}
