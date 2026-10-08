"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { SectionState, SectionSwitch, SectionToggleList } from "@/components/pp/section-toggle-list";
import { ThemePicker } from "@/components/pp/theme-picker";
import { SaveBar } from "@/components/save/save-bar";
import { BaseDesign, type BaseValues } from "@/components/store-admin/base-design";
import { AboutEditor, AnnouncementEditor, HeroEditor, NewsletterEditor, OrderBumpEditor } from "@/components/store-admin/design-panels";
import { HtmlEditor } from "@/components/store-admin/html-editor";
import { StorePreview } from "@/components/store-admin/store-preview";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { getCollections, getProducts, getStoreDesign, updateStore, updateStoreDesign } from "@/lib/api";
import type { SectionId, StoreDesign } from "@/lib/types";

/**
 * Design › Base design. The look of the whole store in one place: brand colour (stores.brand_color),
 * fonts, corners, colour mode (stores.theme_mode) and logo. Everything else is under Advanced.
 */
/** The home page's settings, one panel each. Clicking a section in the preview opens its panel. */
const PANELS = [
  { id: "sections", title: "Sections: on, off and order" },
  { id: "announcement", title: "Announcement bar" },
  { id: "hero", title: "Headline and backgrounds" },
  { id: "about", title: "About you" },
  { id: "faq", title: "FAQ" },
  { id: "newsletter", title: "Newsletter" },
  { id: "html", title: "Custom HTML" },
  { id: "bump", title: "Checkout add-on" },
  { id: "look", title: "Advanced: palette, accent and hero layout" },
] as const;

/** Which panel edits each section; sections with nothing to type (bestsellers, reviews…) open the section list. */
const PANEL_OF: Record<SectionId, (typeof PANELS)[number]["id"]> = {
  announcement: "announcement",
  hero: "hero",
  highlights: "sections",
  collections: "sections",
  bestsellers: "sections",
  new: "sections",
  offers: "sections",
  reviews: "sections",
  html: "html",
  about: "about",
  faq: "faq",
  newsletter: "newsletter",
};

/** The panels that edit one home section. Their switch is the same setting as the one in the section list. */
const SECTION_OF: Partial<Record<(typeof PANELS)[number]["id"], SectionId>> = { announcement: "announcement", hero: "hero", about: "about", faq: "faq", newsletter: "newsletter", html: "html" };

export default function BaseDesignPage() {
  const saved = useApi(getStoreDesign, []);
  const store = useCurrentStore();
  const products = useApi(() => getProducts(), []);
  const collections = useApi(getCollections, []);
  const [draft, setDraft] = useState<{ design: StoreDesign; logo: BaseValues["logo"] }>();
  const [publishing, setPublishing] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [picked, setPicked] = useState<SectionId>();

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

  const storeId = store.data?.id ?? "current";
  function pick(section: SectionId) {
    const panel = PANEL_OF[section];
    if (!panel) return;
    setPicked(section);
    setOpen([panel]);
    // Let the panel open, then bring it into view
    setTimeout(() => document.getElementById(`dd-${panel}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  }

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
          <div className="mt-6 border-t pt-4">
            <h2 className="font-sans text-base font-semibold tracking-normal">Home page</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Click any section in the preview to edit it right here.</p>
          </div>
          <Accordion type="multiple" value={open} onValueChange={setOpen} className="mt-2">
            {PANELS.map((p) => (
              <AccordionItem key={p.id} value={p.id} id={`dd-${p.id}`} className="scroll-mt-4">
                <AccordionTrigger className="min-h-11">
                  {p.title}
                  {SECTION_OF[p.id] && <SectionState on={design.sections.find((x) => x.id === SECTION_OF[p.id])?.enabled} />}
                </AccordionTrigger>
                <AccordionContent>
                  {SECTION_OF[p.id] && (
                    <SectionSwitch
                      id={SECTION_OF[p.id]!}
                      sections={design.sections}
                      onChange={(sections) => set({ ...design, sections })}
                      needs={p.id === "html" && !design.html ? "Upload a file first." : p.id === "announcement" && !design.announcement.text.trim() ? "Type the text below first." : undefined}
                    />
                  )}
                  {p.id === "sections" && <SectionToggleList sections={design.sections} highlight={picked} onChange={(sections) => set({ ...design, sections })} />}
                  {p.id === "announcement" && <AnnouncementEditor design={design} onChange={set} />}
                  {p.id === "hero" && <HeroEditor design={design} products={products.data ?? []} collections={collections.data ?? []} onChange={set} />}
                  {p.id === "about" && <AboutEditor design={design} onChange={set} />}
                  {p.id === "faq" && (
                    <p className="text-sm text-muted-foreground">
                      Your questions and answers are shared with the FAQ page.{" "}
                      <Link href={`/store/${storeId}/pages/faq`} className="font-medium text-primary underline underline-offset-4">Edit the questions</Link>
                    </p>
                  )}
                  {p.id === "newsletter" && <NewsletterEditor design={design} onChange={set} />}
                  {p.id === "html" && (
                    <HtmlEditor
                      value={design.html}
                      onChange={(html) => set({ ...design, html, sections: design.sections.map((s) => (s.id === "html" ? { ...s, enabled: !!html } : s)) })}
                    />
                  )}
                  {p.id === "bump" && <OrderBumpEditor design={design} products={products.data ?? []} onChange={set} />}
                  {p.id === "look" && <ThemePicker theme={design.theme} onChange={(theme) => set({ ...design, theme })} />}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <StorePreview slug={store.data.slug} design={design} onSelect={pick} />
      </div>
    </>
  );
}
