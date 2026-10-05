"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DealPreview } from "@/components/pp/deal-preview";
import { DealRuleWizard, draftFromRule, emptyDraft, inputFromDraft, previewRule, type WizardDraft } from "@/components/pp/deal-rule-wizard";
import { SaveBar } from "@/components/save/save-bar";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Switch } from "@/components/ui/switch";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { saveDealRule } from "@/lib/api";
import type { Deal, DealRule, Product } from "@/lib/types";

/** Wizard on the left, live test-mode preview on the right (below on phones). */
export function DealPathEditor({ rule, rules, products, storeDeals }: { rule?: DealRule; rules: DealRule[]; products: Product[]; storeDeals: Deal[] }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<WizardDraft>(() => (rule ? draftFromRule(rule) : emptyDraft()));
  const [draft, setDraft] = useState<WizardDraft>(baseline);
  const unsaved = useUnsavedGuard();
  const bar = useDirtyForm({
    value: draft,
    saved: baseline,
    onSave: async (d) => {
      const saved = await saveDealRule(inputFromDraft(d));
      if (rule) {
        // Stay on the page; the saved rule becomes the new baseline so the bar hides
        setBaseline(d);
      } else {
        setBaseline(d);
        router.push(`/store/offers/deal-paths/${saved.id}`);
      }
    },
    onDiscard: () => setDraft(baseline),
    savedMessage: rule ? "Deal path saved" : "Deal path created",
  });
  const [withOthers, setWithOthers] = useState(false);
  const [now] = useState(() => Date.now());
  const previewRules = useMemo(() => {
    const mine = previewRule(draft, now);
    return withOthers ? [mine, ...rules.filter((r) => r.id !== mine.id)] : [mine];
  }, [draft, now, withOthers, rules]);

  const leave = () => router.push("/store/offers/deal-paths");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      {rule && <SaveBar state={bar} className="lg:col-span-2 md:ml-auto md:w-fit" />}
      {!rule && bar.error && <p role="alert" className="text-sm font-medium text-danger lg:col-span-2">{bar.error}</p>}
      <DealRuleWizard draft={draft} onChange={setDraft} products={products} onSave={bar.save} onCancel={() => (bar.dirty ? unsaved.confirmLeave(leave) : leave())} saving={bar.saving} />
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
