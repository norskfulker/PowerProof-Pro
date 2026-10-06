"use client";

import { use } from "react";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { RuleSummaryChip } from "@/components/pp/deal-parts";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { DealPathEditor } from "@/components/store-admin/deal-path-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { dealRuleStatus, getDealRule, getDealRules, getOffers, getProducts } from "@/lib/api";
import { formatPct } from "@/lib/format";

export default function DealPathPage({ params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const { ruleId: id } = use(params);
  const { data, error, reload } = useApi(() => Promise.all([getDealRule(id), getProducts(), getDealRules(), getOffers()]), [id]);
  const rule = data?.[0];
  return (
    <>
      <title>{`${rule?.name ?? "Deal path"} · PowerProof`}</title>
      <PageHeader
        title={rule?.name ?? "Deal path"}
        back={{ href: "/store/current/offers/deal-paths", label: "Deal paths" }}
        eyebrow={rule ? <StatusPill status={dealRuleStatus(rule)} /> : undefined}
        description={rule ? <RuleSummaryChip rule={rule} titleOf={(pid) => data?.[1].find((p) => p.id === pid)?.title ?? "a product"} /> : undefined}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || !rule ? (
        <div className="flex flex-col gap-6" aria-busy>
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-[28rem] rounded-card" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section aria-label="How it's doing" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Shown at checkout" value={rule.stats.views.toLocaleString("en-IN")} />
            <StatCard label="Orders that used it" value={rule.stats.uses.toLocaleString("en-IN")} />
            <StatCard label="Take-up" value={rule.stats.views ? formatPct((rule.stats.uses / rule.stats.views) * 100) : "–"} hint="Orders ÷ times shown" />
            <StatCard label="Extra revenue" value={<MoneyText value={rule.stats.revenueLift} />} hint="From items buyers added" emphasis />
          </section>
          <DealPathEditor key={rule.id} rule={rule} products={data[1]} rules={data[2]} storeDeals={data[3].deals} />
        </div>
      )}
    </>
  );
}
