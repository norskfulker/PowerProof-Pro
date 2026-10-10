"use client";

import { useState } from "react";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { SkipLink } from "@/components/pp/app-shell";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreNavbar } from "@/components/pp/store-navbar";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { layoutOf } from "@/lib/site-styles";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { useApi } from "@/hooks/use-api";
import { useTheme } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { getBuyerStoreTheme, getStorefront, setBuyerStoreTheme } from "@/lib/api";
import { resolveStoreMode, schemeClass, targetHref } from "@/lib/store-themes";
import type { CurrencyCode } from "@/lib/types";
import { StoreAnalytics } from "./store-analytics";
import { StorefrontProvider, useStorefront } from "./storefront-context";

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
  const { view } = useStorefront();
  const { store, design } = view;
  const site = useTheme().mode;
  const [buyer, setBuyer] = useState<"light" | "dark" | undefined>(() => getBuyerStoreTheme(store.id));
  const mode = resolveStoreMode(design.theme, site, buyer);
  const announcementOn = design.sections.find((s) => s.id === "announcement")?.enabled;
  return (
    <StoreThemeScope theme={design.theme} mode={mode} className="flex min-h-dvh flex-col">
      <SkipLink />
      <StoreAnalytics store={store} tags={design.analytics} products={view.products} />
      {announcementOn && design.announcement.text.trim() && (
        <div data-store-chrome><AnnouncementBar announcement={design.announcement} href={design.announcement.target ? targetHref(store.slug, design.announcement.target) : undefined} /></div>
      )}
      <div data-store-chrome className={cn(design.header?.sticky !== false && "sticky top-0 z-30", schemeClass(design.header?.scheme))}><StoreNavbar store={store} collections={view.collections} header={{ ...design.header, sticky: false }} /></div>
      <main id="main" className="flex-1">{children}</main>
      <div data-store-chrome><CurrencyBar /></div>
      <div data-store-chrome className={schemeClass(design.footer?.scheme)}>
      <StoreFooter
        store={store}
        socials={design.socials}
        showPoweredBy={design.showPoweredBy}
        pages={view.extraPages}
        layout={layoutOf(design.theme).footer}
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

/** Loads a store once for every page under /s/[store] and applies its theme. */
export function StoreShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { data, error, reload } = useApi(() => getStorefront(slug), [slug], { live: true });
  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="store" />;
  return (
    <StorefrontProvider slug={slug} view={data} reload={reload}>
      <title>{data.design.seo.title || data.store.name}</title>
      <meta name="description" content={data.design.seo.description} />
      <Chrome>{children}</Chrome>
    </StorefrontProvider>
  );
}
