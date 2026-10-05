"use client";

import { use, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BlockInspector, BlockList } from "@/components/pages/block-panel";
import { EditorBar, EditorSkeletonOrError } from "@/components/pages/editor-bar";
import { PageRenderer } from "@/components/pages/page-renderer";
import { useApi } from "@/hooks/use-api";
import { getPage, getProducts, getStore, updatePage } from "@/lib/api";
import type { Page } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function VisualEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const saved = useApi(() => getPage(id), [id]);
  const products = useApi(() => getProducts(), []);
  const store = useApi(getStore, []);
  const [draft, setDraft] = useState<Page>();
  const [selected, setSelected] = useState<string>();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);

  if (!saved.data || saved.error) return <EditorSkeletonOrError error={saved.error} onRetry={saved.reload} />;

  const page = draft ?? saved.data;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved.data);
  const change = (p: Partial<Page>) => setDraft({ ...page, ...p });
  const product = products.data?.find((p) => p.id === page.productIds[0]);
  const block = page.blocks.find((b) => b.id === selected);

  async function save() {
    setSaving(true);
    try {
      const out = await updatePage(page.id, page);
      saved.setData(out);
      setDraft(undefined);
      toast.success(out.status === "live" ? "Saved. The page is live." : "Saved as a draft");
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className="sr-only">Edit page: {page.title}</h1>
      <EditorBar
        page={page}
        products={products.data ?? []}
        dirty={dirty}
        saving={saving}
        onChange={change}
        onSave={save}
        modeSwitch={{ href: `/pages/${page.id}/html`, label: "HTML and embed" }}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6 rounded-card border bg-surface p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-120px)] lg:self-start lg:overflow-y-auto">
          <BlockList blocks={page.blocks} selectedId={selected} onSelect={setSelected} onChange={(blocks) => change({ blocks })} />
          <div className="border-t pt-4">
            {block ? (
              <BlockInspector
                block={block}
                onChange={(b) => change({ blocks: page.blocks.map((x) => (x.id === b.id ? b : x)) })}
                onDelete={() => {
                  change({ blocks: page.blocks.filter((x) => x.id !== block.id) });
                  setSelected(undefined);
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Click any block in the preview to edit its words.</p>
            )}
          </div>
        </aside>

        <section aria-label="Preview" className="flex flex-col overflow-hidden rounded-card border bg-surface-sunken">
          <div className="flex items-center justify-between border-b bg-surface px-4 py-2">
            <p className="eyebrow">Preview · buy button opens checkout{product ? ` for ${product.title}` : ""}</p>
            <div className="flex gap-2" role="group" aria-label="Preview size">
              <Button size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} aria-label="Desktop preview"><Monitor /></Button>
              <Button size="icon-sm" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} aria-label="Phone preview"><Smartphone /></Button>
            </div>
          </div>
          <div className="flex justify-center p-3 md:p-6">
            <div className={cn("w-full overflow-hidden rounded-card border bg-surface transition-[max-width] duration-200", device === "mobile" ? "max-w-[390px]" : "max-w-none")}>
              <PageRenderer
                blocks={page.blocks}
                selectedId={selected}
                onSelect={setSelected}
                storeName={store.data?.name}
                compact={device === "mobile"}
                product={product ? { title: product.title, price: product.price, image: product.images[0] } : undefined}
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
