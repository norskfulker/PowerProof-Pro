"use client";

import { useMemo, useState } from "react";
import { BarChart3, MousePointerClick } from "lucide-react";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { SaveBar } from "@/components/save/save-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { getStoreDesign, updateStoreDesign } from "@/lib/api";
import { cleanTags, clarityError, ga4Error } from "@/lib/analytics-tags";

/** Google Analytics and Microsoft Clarity IDs for this store. Shared by Tools and Store › Analytics tags. */
export function IntegrationsList({ title = "Integrations", description = "Paste one ID and we add the tracking code to every page of your store. No code to touch." }: { title?: string; description?: string }) {
  const design = useApi(getStoreDesign, []);
  const [draft, setDraft] = useState<{ ga4Id: string; clarityId: string }>();
  const saved = useMemo(() => ({ ga4Id: design.data?.analytics?.ga4Id ?? "", clarityId: design.data?.analytics?.clarityId ?? "" }), [design.data]);
  const value = draft ?? saved;
  const ga = ga4Error(value.ga4Id);
  const cl = clarityError(value.clarityId);

  const bar = useDirtyForm({
    value,
    saved,
    validate: () => !ga && !cl,
    onSave: async (v) => {
      if (!design.data) return;
      const tags = cleanTags({ ga4Id: v.ga4Id, clarityId: v.clarityId });
      const out = await updateStoreDesign({ ...design.data, analytics: Object.keys(tags).length ? tags : undefined });
      design.setData(out);
      setDraft(undefined);
    },
    onDiscard: () => setDraft(undefined),
    savedMessage: "Analytics saved",
  });

  if (design.error) return <><PageHeader title={title} description={description} /><ErrorState message={design.error} onRetry={design.reload} /></>;
  if (!design.data) return <><PageHeader title={title} description={description} /><Skeleton className="h-64 rounded-card" /></>;

  return (
    <>
      <PageHeader title={title} description={description} actions={<SaveBar state={bar} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="ga-h" className="flex flex-col gap-3 rounded-card border bg-surface p-5 md:p-6">
          <h2 id="ga-h" className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal"><BarChart3 className="size-5 text-primary" aria-hidden /> Google Analytics 4</h2>
          <p className="text-sm text-muted-foreground">See visitors, pages and purchases in your own Google Analytics. We send page views, product views and purchases.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ga4">Measurement ID</Label>
            <Input id="ga4" className="font-mono uppercase" placeholder="G-ABC123XYZ" autoComplete="off" spellCheck={false} aria-invalid={!!ga || undefined} aria-describedby="ga4-hint" value={value.ga4Id} onChange={(e) => setDraft({ ...value, ga4Id: e.target.value })} />
            <p id="ga4-hint" className={ga ? "text-sm font-medium text-danger" : "text-xs text-muted-foreground"}>{ga ?? "In Google Analytics: Admin › Data streams › your web stream."}</p>
          </div>
        </section>
        <section aria-labelledby="cl-h" className="flex flex-col gap-3 rounded-card border bg-surface p-5 md:p-6">
          <h2 id="cl-h" className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal"><MousePointerClick className="size-5 text-primary" aria-hidden /> Microsoft Clarity</h2>
          <p className="text-sm text-muted-foreground">Free heatmaps and session recordings, to see where people get stuck.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clarity">Project ID</Label>
            <Input id="clarity" className="font-mono" placeholder="abcd1234ef" autoComplete="off" spellCheck={false} aria-invalid={!!cl || undefined} aria-describedby="cl-hint" value={value.clarityId} onChange={(e) => setDraft({ ...value, clarityId: e.target.value })} />
            <p id="cl-hint" className={cl ? "text-sm font-medium text-danger" : "text-xs text-muted-foreground"}>{cl ?? "In Clarity: your project › Settings › Overview."}</p>
          </div>
        </section>
      </div>
      <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
        Visitors are asked once before either tag loads, and nothing loads if they say no. Separately, PowerProof counts visits for your dashboard without cookies or personal data, so Visitors, Where buyers come from and the Funnel work even without these.
      </p>
    </>
  );
}
