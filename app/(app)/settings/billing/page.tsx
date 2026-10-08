"use client";

import { SettingsTabs } from "@/components/settings/settings-tabs";
import { CreditCard, Receipt, Sparkles } from "lucide-react";
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

export default function BillingPage() {
  const { data, error, reload } = useApi(getPlan, [], { live: true });
  const planCtx = usePlan();
  if (!data) return <SettingsLoading error={error} onRetry={reload} />;
  const { plan } = data;
  const trial = plan.status === "trial";

  return (
    <>
    <SettingsTabs
      label="Billing"
      tabs={[
        { id: "plan", label: "Plan", content: (
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
        ) },
        { id: "usage", label: "Usage and limits", content: (
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
        ) },
        { id: "payment", label: "Payment method", content: (
      <SettingsSection title="Payment method" description="Cards are handled by the payment gateway's secure page. PowerProof never sees the number.">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary"><CreditCard className="size-5" aria-hidden /></span>
          <span className="flex-1">
            {plan.cardLast4 ? (
              <><span className="block font-medium">Card ····{plan.cardLast4}</span><span className="text-sm text-muted-foreground">Charged on the 1st</span></>
            ) : (
              <><span className="block font-medium">No card yet</span><span className="text-sm text-muted-foreground">Needed when the free month ends</span></>
            )}
          </span>
          <Button variant="secondary" disabled title="Card payments open soon">
            {plan.cardLast4 ? "Change card" : "Add card (opens soon)"}
          </Button>
        </div>
      </SettingsSection>
        ) },
        { id: "invoices", label: "Invoices", content: (
      <SettingsSection title="PowerProof invoices" description="Subscription plus platform fees, one invoice a month. GST invoice if you've added your GSTIN.">
        <EmptyState compact icon={Receipt} title="No invoices yet." body="PowerProof invoices appear here once billing is connected and your first month is over." />
      </SettingsSection>
        ) },
      ]}
    />

    </>
  );
}
