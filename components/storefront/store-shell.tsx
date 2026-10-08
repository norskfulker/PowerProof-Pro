"use client";

import { useEffect, useState } from "react";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { SkipLink } from "@/components/pp/app-shell";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreNavbar } from "@/components/pp/store-navbar";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { useApi } from "@/hooks/use-api";
import { useTheme } from "@/components/theme/theme-toggle";
import { getBuyerStoreTheme, getStorefront, setBuyerStoreTheme } from "@/lib/api";
import { resolveStoreMode } from "@/lib/store-themes";
import type { CurrencyCode, StoreDesign } from "@/lib/types";
import { StoreAnalytics } from "./store-analytics";
import { StorefrontProvider, useStorefront } from "./storefront-context";

/**
 * Inside the design editor's preview, clicking a section tells the editor to open that section's
 * settings (instead of following links or pressing buttons). Sections get an outline on hover.
 */
export function PreviewPicker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-pp-section]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: "pp-select", section: el.getAttribute("data-pp-section") }, window.location.origin);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return <style>{`[data-pp-section]{cursor:pointer;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .15s}[data-pp-section]:hover{outline-color:var(--primary)}`}</style>;
}

/** Pick the currency to see prices in. Only offered when rates are loaded; checkout is always in the store's currency. */
function CurrencyBar() {
  const { view, currency, setCurrency, convertible } = useStorefront();
  if (!convertible) return null;
  const options = (Object.keys(view.rates ?? {}) as CurrencyCode[]).sort();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm text-muted-foreground">
      <label htmlFor="show-prices-in">Show prices in</label>
      <select id="show-prices-in" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="h-9 rounded-control border bg-surface px-2 text-foreground pointer-coarse:h-11">
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {currency !== view.store.currency && <span>Converted for reference. You pay in {view.store.currency} at checkout.</span>}
    </div>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const { view, preview } = useStorefront();
  const { store, design } = view;
  const site = useTheme().mode;
  const [buyer, setBuyer] = useState<"light" | "dark" | undefined>(() => getBuyerStoreTheme(store.id));
  // The design preview shows what the creator picked, not this browser's buyer choice
  const mode = resolveStoreMode(design.theme, site, preview ? undefined : buyer);
  const announcementOn = design.sections.find((s) => s.id === "announcement")?.enabled;
  return (
    <StoreThemeScope theme={design.theme} mode={mode} className="flex min-h-dvh flex-col">
      <SkipLink />
      {preview && <PreviewPicker />}
      {!preview && <StoreAnalytics store={store} tags={design.analytics} products={view.products} />}
      {announcementOn && design.announcement.text.trim() && (
        <div data-pp-section="announcement" data-store-chrome><AnnouncementBar announcement={design.announcement} /></div>
      )}
      <div data-store-chrome><StoreNavbar store={store} collections={view.collections} /></div>
      <main id="main" className="flex-1">{children}</main>
      {!preview && <div data-store-chrome><CurrencyBar /></div>}
      <div data-store-chrome>
      <StoreFooter
        store={store}
        socials={design.socials}
        showPoweredBy={design.showPoweredBy}
        pages={view.extraPages}
        theme={{
          mode,
          onChange: (m) => {
            // Picking what the store would show anyway clears the override
            const next = m === resolveStoreMode(design.theme, site) ? undefined : m;
            setBuyerStoreTheme(store.id, next);
            setBuyer(next);
          },
        }}
      />
      </div>
    </StoreThemeScope>
  );
}

/**
 * Loads a store once for every page under /s/[store] and applies its theme.
 * Inside the design editor's preview iframe it also accepts draft designs by postMessage.
 */
export function StoreShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { data, error, reload } = useApi(() => getStorefront(slug), [slug], { live: true });
  const [draft, setDraft] = useState<StoreDesign>();
  const [inFrame] = useState(() => typeof window !== "undefined" && window.self !== window.top);

  useEffect(() => {
    if (!inFrame) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "pp-design") setDraft(e.data.design as StoreDesign);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "pp-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, [inFrame]);

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="store" />;
  const view = draft ? { ...data, design: draft } : data;
  return (
    <StorefrontProvider slug={slug} view={view} reload={reload} preview={inFrame}>
      <title>{view.design.seo.title || view.store.name}</title>
      <meta name="description" content={view.design.seo.description} />
      <Chrome>{children}</Chrome>
    </StorefrontProvider>
  );
}
