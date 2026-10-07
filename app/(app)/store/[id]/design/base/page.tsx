"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { SectionToggleList } from "@/components/pp/section-toggle-list";
import { ThemePicker } from "@/components/pp/theme-picker";
import { SaveBar } from "@/components/save/save-bar";
import { BaseDesign, type BaseValues } from "@/components/store-admin/base-design";
import { ContentEditor, HeroEditor } from "@/components/store-admin/design-panels";
import { StorePreview } from "@/components/store-admin/store-preview";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { getCollections, getProducts, getStoreDesign, updateStore, updateStoreDesign } from "@/lib/api";
import type { StoreDesign } from "@/lib/types";

/**
 * Design › Base design. The look of the whole store in one place: brand colour (stores.brand_color),
 * fonts, corners, colour mode (stores.theme_mode) and logo. Everything else is under Advanced.
 */
export default function BaseDesignPage() {
  const saved = useApi(getStoreDesign, []);
  const store = useCurrentStore();
  const products = useApi(() => getProducts(), []);
  const collections = useApi(getCollections, []);
  const [draft, setDraft] = useState<{ design: StoreDesign; logo: BaseValues["logo"] }>();
  const [publishing, setPublishing] = useState(false);

  const current = saved.data && store.data ? { design: saved.data, logo: store.data.logo } : undefined;
  const bar = useDirtyForm({
    value: draft ?? current,
    saved: current,
    onSave: async (v) => {
      if (!v) return;
      // Brand colour and logo are columns on stores; the rest of the look is stores.theme and theme_mode
      await updateStore({ brandColor: v.design.theme.brand, logo: v.logo });
      const out = await updateStoreDesign(v.design);
      saved.setData(out);
      store.reload();
      setDraft(undefined);
    },
    onDiscard: () => setDraft(undefined),
    savedMessage: "Design saved. Buyers see the new look now.",
  });

  if (saved.error || store.error) return <ErrorState message={saved.error ?? store.error} onRetry={() => { saved.reload(); store.reload(); }} />;
  if (!current || !store.data) return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]"><Skeleton className="h-[640px] rounded-card" /><Skeleton className="h-[640px] rounded-card" /></div>;

  const value = draft ?? current;
  const design = value.design;
  const set = (d: StoreDesign) => setDraft({ ...value, design: d });
  const live = store.data.onboarded;

  async function publishStore() {
    setPublishing(true);
    try {
      await updateStore({ onboarded: true });
      store.reload();
      toast.success("Your store is live", { description: "Share your link to get your first sale." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't publish.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <title>Base design · PowerProof</title>
      <PageHeader
        title="Base design"
        description="One look for the whole store. Your pages inherit it."
        actions={!live ? <Button onClick={publishStore} disabled={publishing} data-coach="publish-store">{publishing ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Publish your store</Button> : undefined}
      />
      {!live && <p className="-mt-3 mb-4 text-sm text-muted-foreground">Your store isn&apos;t visible to buyers yet. Publish when you&apos;re ready; you can keep changing it after.</p>}
      <SaveBar state={bar} label="Changes show in the preview only until you save" className="mb-4 md:ml-auto md:w-fit" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-card border bg-surface p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-120px)] lg:self-start lg:overflow-y-auto">
          <BaseDesign value={value} onChange={(v) => setDraft(v)} />
          <Accordion type="multiple" className="mt-6 border-t">
            <AccordionItem value="advanced-look">
              <AccordionTrigger className="min-h-11">Advanced: palette, accent and hero layout</AccordionTrigger>
              <AccordionContent><ThemePicker theme={design.theme} onChange={(theme) => set({ ...design, theme })} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="advanced-sections">
              <AccordionTrigger className="min-h-11">Advanced: home page sections</AccordionTrigger>
              <AccordionContent><SectionToggleList sections={design.sections} onChange={(sections) => set({ ...design, sections })} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="advanced-hero">
              <AccordionTrigger className="min-h-11">Advanced: headline and backgrounds</AccordionTrigger>
              <AccordionContent><HeroEditor design={design} products={products.data ?? []} collections={collections.data ?? []} onChange={(d) => set(d)} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="advanced-content">
              <AccordionTrigger className="min-h-11">Advanced: announcement and newsletter</AccordionTrigger>
              <AccordionContent><ContentEditor design={design} products={products.data ?? []} onChange={(d) => set(d)} /></AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <StorePreview slug={store.data.slug} design={design} />
      </div>
    </>
  );
}
