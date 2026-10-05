"use client";

import { use, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EditorBar, EditorSkeletonOrError } from "@/components/pages/editor-bar";
import { copyText, CopyField } from "@/components/pp/copy-field";
import { findBuyButtons, HtmlPasteEditor } from "@/components/pp/html-paste-editor";
import { MoneyText } from "@/components/pp/money-text";
import { useApi } from "@/hooks/use-api";
import { getPage, getProducts, getStore, STARTER_HTML, updatePage } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import type { Page } from "@/lib/types";

export default function HtmlEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const saved = useApi(() => getPage(id), [id]);
  const products = useApi(() => getProducts(), []);
  const store = useApi(getStore, []);
  const [draft, setDraft] = useState<Page>();
  const [saving, setSaving] = useState(false);

  if (!saved.data || saved.error) return <EditorSkeletonOrError error={saved.error} onRetry={saved.reload} />;

  const page = draft ?? { ...saved.data, html: saved.data.html || STARTER_HTML };
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved.data);
  const change = (p: Partial<Page>) => setDraft({ ...page, ...p });
  const names = Object.fromEntries((products.data ?? []).map((p) => [p.id, p.title]));
  const wired = findBuyButtons(page.html);
  const unknown = wired.filter((w) => !names[w]);
  const embed = `<script src="https://${SITE_URL}/embed.js" data-store="${store.data?.slug ?? "your-store"}" async></script>`;

  async function save() {
    if (unknown.length) {
      toast.error("Some buy buttons point nowhere", { description: `Unknown product ID: ${unknown.join(", ")}` });
      return;
    }
    setSaving(true);
    try {
      // Pasted <script> tags are stripped before publishing; buy buttons are wired by us.
      const html = page.html.replace(/<script[\s\S]*?<\/script>/gi, "");
      const out = await updatePage(page.id, { ...page, mode: "html", html, productIds: wired.length ? [...new Set(wired)] : page.productIds });
      saved.setData(out);
      setDraft(undefined);
      toast.success("Saved", { description: `${wired.length} buy button${wired.length === 1 ? "" : "s"} wired.` });
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className="sr-only">Edit HTML: {page.title}</h1>
      <EditorBar page={page} products={products.data ?? []} dirty={dirty || !saved.data.html} saving={saving} onChange={change} onSave={save} modeSwitch={{ href: `/pages/${page.id}/edit`, label: "Visual editor" }} />
      <HtmlPasteEditor value={page.html} onChange={(html) => change({ html })} productNames={names} />

      {unknown.length > 0 && (
        <p role="alert" className="mt-4 rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          {unknown.length === 1 ? "One button points" : `${unknown.length} buttons point`} at a product ID we don&apos;t know: <span className="font-mono">{unknown.join(", ")}</span>. Copy an ID from the list below.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="ids-h" className="rounded-card border bg-surface p-5 md:p-6">
          <h2 id="ids-h" className="font-sans text-base font-semibold tracking-normal">Your product IDs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add <code className="rounded bg-muted px-1 font-mono text-[13px]">data-pp-buy=&quot;ID&quot;</code> to any button or link. It opens checkout for that product.
          </p>
          <ul className="mt-4 divide-y rounded-control border">
            {products.data?.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                </span>
                <MoneyText value={p.price} mono className="text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Copy buy button for ${p.title}`}
                  onClick={() => copyText(`<button data-pp-buy="${p.id}">Buy ${p.title}</button>`, "Buy button copied")}
                >
                  <Copy />
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="embed-h" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
          <h2 id="embed-h" className="font-sans text-base font-semibold tracking-normal">Use it on your own website</h2>
          <p className="text-sm text-muted-foreground">
            Paste this once before the closing body tag on any site (WordPress, Webflow, Notion sites, plain HTML). Every <span className="font-mono text-[13px]">data-pp-buy</span> button on that site starts checkout.
          </p>
          <CopyField label="Embed code" value={embed} multiline toastText="Embed code copied" />
          <CopyField label="Example button" value={`<button data-pp-buy="${products.data?.[0]?.id ?? "PRODUCT_ID"}">Buy now</button>`} multiline toastText="Button copied" />
        </section>
      </div>
    </>
  );
}
