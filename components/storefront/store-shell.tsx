"use client";

import { useEffect, useState } from "react";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { SkipLink } from "@/components/pp/app-shell";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreNavbar } from "@/components/pp/store-navbar";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { useApi } from "@/hooks/use-api";
import { getStorefront } from "@/lib/api";
import type { StoreDesign } from "@/lib/types";
import { StorefrontProvider, useStorefront } from "./storefront-context";

function Chrome({ children }: { children: React.ReactNode }) {
  const { view, currency, setCurrency } = useStorefront();
  const { store, design } = view;
  const announcementOn = design.sections.find((s) => s.id === "announcement")?.enabled;
  return (
    <StoreThemeScope theme={design.theme} className="flex min-h-dvh flex-col">
      <SkipLink />
      {announcementOn && <AnnouncementBar announcement={design.announcement} />}
      <StoreNavbar store={store} collections={view.collections} currency={currency} onCurrency={setCurrency} />
      <main id="main" className="flex-1">{children}</main>
      <StoreFooter store={store} socials={design.socials} showPoweredBy={design.showPoweredBy} pages={view.extraPages} />
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
