"use client";

import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
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
import { SaveBar } from "@/components/save/save-bar";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { getCollections, getProducts, getStore, getStoreDesign, updateStore, updateStoreDesign } from "@/lib/api";
import type { StoreDesign } from "@/lib/types";

const SECTIONS = ["theme", "sections", "backgrounds", "content"] as const;
type Section = (typeof SECTIONS)[number];

export default function StoreDesignPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = use(params);
  const router = useRouter();
  if (!SECTIONS.includes(section as Section)) notFound();
  const tab = section as Section;
  // Tabs are routes (/store/[id]/design/theme …), so the menu, breadcrumbs and back button agree
  const setTab = (t: string) => router.replace(`/store/${id}/design/${t}`, { scroll: false });
  const saved = useApi(getStoreDesign, []);
  const store = useApi(getStore, []);
  const products = useApi(() => getProducts(), []);
  const collections = useApi(getCollections, []);
  const [draft, setDraft] = useState<StoreDesign>();
  const [publishing, setPublishing] = useState(false);
  const bar = useDirtyForm({
    value: draft ?? saved.data,
    saved: saved.data,
    onSave: async (d) => {
      if (!d) return;
      const out = await updateStoreDesign(d);
      saved.setData(out);
      setDraft(undefined);
    },
    onDiscard: () => setDraft(undefined),
    savedMessage: "Store updated. Buyers see the new look now.",
  });

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
  const live = store.data.onboarded;

  async function publishStore() {
    setPublishing(true);
    try {
      await updateStore({ onboarded: true });
      store.reload();
      toast.success("Your store is live", { description: "Share your link to get your first sale." });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Store design"
        description="Turn sections on and off, reorder them, pick a look. The layout is proven; you choose what goes in it."
        actions={
          !live ? (
            <Button onClick={publishStore} disabled={publishing} data-coach="publish-store">
              {publishing ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Publish your store
            </Button>
          ) : undefined
        }
      />
      {!live && <p className="-mt-3 mb-4 text-sm text-muted-foreground">Your store isn&apos;t visible to buyers yet. Publish when you&apos;re ready; you can keep changing it after.</p>}
      <SaveBar state={bar} label="Changes show in the preview only until you save" className="mb-4 md:ml-auto md:w-fit" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-card border bg-surface p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-120px)] lg:self-start lg:overflow-y-auto">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="backgrounds">Hero and backgrounds</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>
            <TabsContent value="sections" className="pt-3"><SectionToggleList sections={design.sections} onChange={(sections) => setDraft({ ...design, sections })} /></TabsContent>
            <TabsContent value="theme" className="pt-3"><ThemePicker theme={design.theme} onChange={(theme) => setDraft({ ...design, theme })} /></TabsContent>
            <TabsContent value="backgrounds" className="pt-3"><HeroEditor design={design} products={products.data ?? []} collections={collections.data ?? []} onChange={setDraft} /></TabsContent>
            <TabsContent value="content" className="pt-3"><ContentEditor design={design} products={products.data ?? []} onChange={setDraft} /></TabsContent>
          </Tabs>
        </div>
        <StorePreview slug={store.data.slug} design={design} />
      </div>
    </>
  );
}
