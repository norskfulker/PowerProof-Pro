"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DealPreview } from "@/components/pp/deal-preview";
import { DealRuleWizard, draftFromRule, emptyDraft, inputFromDraft, previewRule, type WizardDraft } from "@/components/pp/deal-rule-wizard";
import { Switch } from "@/components/ui/switch";
import { saveDealRule } from "@/lib/api";
import type { Deal, DealRule, Product } from "@/lib/types";

/** Wizard on the left, live test-mode preview on the right (below on phones). */
export function DealPathEditor({ rule, rules, products, storeDeals }: { rule?: DealRule; rules: DealRule[]; products: Product[]; storeDeals: Deal[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<WizardDraft>(() => (rule ? draftFromRule(rule) : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [withOthers, setWithOthers] = useState(false);
  const [now] = useState(() => Date.now());
  const previewRules = useMemo(() => {
    const mine = previewRule(draft, now);
    return withOthers ? [mine, ...rules.filter((r) => r.id !== mine.id)] : [mine];
  }, [draft, now, withOthers, rules]);

  async function save() {
    setSaving(true);
    try {
      const saved = await saveDealRule(inputFromDraft(draft));
      toast.success(rule ? "Deal path saved" : "Deal path created", { description: saved.active ? "Buyers see it at checkout now." : "It's switched off until you turn it on." });
      router.push(`/store/offers/deal-paths/${saved.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <DealRuleWizard draft={draft} onChange={setDraft} products={products} onSave={save} onCancel={() => router.push("/store/offers/deal-paths")} saving={saving} />
      <aside aria-label="Live preview" className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
        <label htmlFor="with-others" className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
          Include my other deal paths
          <Switch id="with-others" checked={withOthers} onCheckedChange={setWithOthers} />
        </label>
        <DealPreview rules={previewRules} products={products} storeDeals={storeDeals} now={now} />
      </aside>
    </div>
  );
}
