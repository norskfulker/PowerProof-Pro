"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { SectionToggleList } from "@/components/pp/section-toggle-list";
import { ThemePicker } from "@/components/pp/theme-picker";
import { ContentEditor, HeroEditor } from "@/components/store-admin/design-panels";
import { StorePreview } from "@/components/store-admin/store-preview";
import { useApi } from "@/hooks/use-api";
import { getCollections, getProducts, getStore, getStoreDesign, updateStoreDesign } from "@/lib/api";
import type { StoreDesign } from "@/lib/types";

export default function StoreDesignPage() {
  const saved = useApi(getStoreDesign, []);
  const store = useApi(getStore, []);
  const products = useApi(() => getProducts(), []);
  const collections = useApi(getCollections, []);
  const [draft, setDraft] = useState<StoreDesign>();
  const [saving, setSaving] = useState(false);

  if (saved.error) return <ErrorState message={saved.error} onRetry={saved.reload} />;
  if (!saved.data || !store.data) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Skeleton className="h-[640px] rounded-card" />
        <Skeleton className="h-[640px] rounded-card" />
      </div>
    );
  }

  const design = draft ?? saved.data;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved.data);

  async function save() {
    setSaving(true);
    try {
      const out = await updateStoreDesign(design);
      saved.setData(out);
      setDraft(undefined);
      toast.success("Store updated", { description: "Buyers see the new look now." });
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Store design"
        description="Turn sections on and off, reorder them, pick a look. The layout is proven; you choose what goes in it."
        actions={
          <>
            <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(undefined)}><RotateCcw aria-hidden /> Discard</Button>
            <Button onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="animate-spin" aria-hidden />}{dirty ? "Publish changes" : "Published"}</Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-card border bg-surface p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-120px)] lg:self-start lg:overflow-y-auto">
          <Tabs defaultValue="sections">
            <TabsList className="w-full">
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="hero">Hero</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>
            <TabsContent value="sections" className="pt-3"><SectionToggleList sections={design.sections} onChange={(sections) => setDraft({ ...design, sections })} /></TabsContent>
            <TabsContent value="theme" className="pt-3"><ThemePicker theme={design.theme} onChange={(theme) => setDraft({ ...design, theme })} /></TabsContent>
            <TabsContent value="hero" className="pt-3"><HeroEditor design={design} products={products.data ?? []} collections={collections.data ?? []} onChange={setDraft} /></TabsContent>
            <TabsContent value="content" className="pt-3"><ContentEditor design={design} products={products.data ?? []} onChange={setDraft} /></TabsContent>
          </Tabs>
        </div>
        <StorePreview slug={store.data.slug} design={design} />
      </div>
      {dirty && <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">Unsaved changes show in the preview only. Publish to make them live.</p>}
    </>
  );
}
