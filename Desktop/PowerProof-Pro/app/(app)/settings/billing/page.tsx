"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/pp/status-pill";
import { usePlan } from "@/components/plan/plan-context";
import { limitsInUse, Meter } from "@/components/plan/plan-usage";
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
  const free = planCtx.state?.tier !== "pro";
  const sub = billing?.subscription;
  const limits = planCtx.state ? limitsInUse(planCtx.state) : [];

  async function cancel() {
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
  }

  // What's next for the plan, in one line
  const next = plan.status === "trial" && plan.trialEndsAt
    ? `Free until ${formatDate(plan.trialEndsAt)}, then ${formatMoney(plan.monthly)}/month.`
    : free
      ? `${plan.platformFeePct}% per sale. No monthly fee.`
      : sub?.currentEnd
        ? `Renews ${formatDate(sub.currentEnd)}. ${plan.platformFeePct}% per sale.`
        : `${formatMoney(plan.monthly)}/month. ${plan.platformFeePct}% per sale.`;

  return (
    <div className="flex flex-col gap-6">
      {/* The plan, what's next, and the one thing to do about it */}
      <SettingsSection title="Plan">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-display text-2xl">{plan.name} <StatusPill status={plan.status} /></p>
            <p className="mt-1 text-sm text-muted-foreground">{next}</p>
          </div>
          {free ? (
            <Button onClick={() => planCtx.upgrade()}><Sparkles aria-hidden /> Upgrade to Pro</Button>
          ) : (
            <Button variant="secondary" disabled={cancelling || !sub} onClick={() => void cancel()}>{cancelling ? "Cancelling…" : "Cancel Pro"}</Button>
          )}
        </div>
      </SettingsSection>

      {/* Limits only exist on Free */}
      {free && limits.length > 0 && (
        <SettingsSection title="Usage">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{limits.map((l) => <Meter key={l.label} {...l} />)}</div>
        </SettingsSection>
      )}

      {!!billing?.receipts.length && (
        <SettingsSection title="Receipts">
          <ul className="divide-y rounded-card border">
            {billing.receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium">{formatMoney(money(r.amountMinor, (r.currency as "INR") || "INR"))}</span>
                <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}
    </div>
  );
}
