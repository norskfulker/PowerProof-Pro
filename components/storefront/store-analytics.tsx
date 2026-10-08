"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cleanTags, gtagEvent, hasTags, loadTags, readConsent, writeConsent } from "@/lib/analytics-tags";
import { sb } from "@/lib/supabase/browser";
import { classifySource, shouldCount } from "@/lib/tracking";
import type { StoreProduct } from "@/lib/api";
import type { AnalyticsTags, Store } from "@/lib/types";

/** A random id for this tab. Not stored beyond the tab, never sent with anything about the person. */
function session(): string {
  try {
    let s = sessionStorage.getItem("pp:visit");
    if (!s) {
      s = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      sessionStorage.setItem("pp:visit", s);
    }
    return s;
  } catch {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
}

/**
 * On a live storefront: counts the visit for the creator's dashboard (cookieless, skipped for
 * Do Not Track and automated browsers), and, when the creator added Google Analytics or Clarity,
 * asks the visitor once and loads the tags only if they agree.
 */
export function StoreAnalytics({ store, tags, products }: { store: Store; tags?: AnalyticsTags; products: StoreProduct[] }) {
  const pathname = usePathname();
  const last = useRef<string>("");
  const [consent, setConsent] = useState<"yes" | "no" | undefined>();
  const [ready, setReady] = useState(false);
  const want = hasTags(tags);

  // Remembered answer, read after load so the page renders the same on the server and in the browser
  useEffect(() => {
    const t = setTimeout(() => {
      setConsent(readConsent(store.id));
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [store.id]);

  useEffect(() => {
    if (consent === "yes" && want) loadTags(cleanTags(tags));
  }, [consent, want, tags]);

  useEffect(() => {
    if (window.self !== window.top || last.current === pathname) return;
    last.current = pathname;
    const product = products.find((p) => pathname === `/s/${store.slug}/${p.slug}`);
    if (consent === "yes") {
      gtagEvent("page_view", { page_path: pathname, page_title: document.title });
      if (product) gtagEvent("view_item", { currency: product.info.price.currency, value: product.info.price.amount / 100, items: [{ item_id: product.id, item_name: product.title, price: product.info.price.amount / 100 }] });
    }
    if (!shouldCount({ doNotTrack: navigator.doNotTrack, webdriver: navigator.webdriver })) return;
    const source = classifySource(document.referrer, window.location.search, window.location.hostname);
    const sid = session();
    void sb().rpc("track_event", { p_store_slug: store.slug, p_kind: "view", p_path: pathname, p_product: undefined as unknown as string, p_source: source, p_session: sid });
    if (product) void sb().rpc("track_event", { p_store_slug: store.slug, p_kind: "product", p_path: pathname, p_product: product.id, p_source: source, p_session: sid });
  }, [pathname, store.slug, products, consent]);

  if (!want || !ready || consent || window.self !== window.top) return null;
  return (
    <div role="dialog" aria-label="Analytics cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-card border bg-surface p-4 shadow-lg sm:flex-row sm:items-center">
      <p className="text-sm">{store.name} uses {tags?.ga4Id && tags?.clarityId ? "Google Analytics and Microsoft Clarity" : tags?.ga4Id ? "Google Analytics" : "Microsoft Clarity"} to see how people use the store. Allow it?</p>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => { writeConsent(store.id, "no"); setConsent("no"); }}>No thanks</Button>
        <Button type="button" size="sm" onClick={() => { writeConsent(store.id, "yes"); setConsent("yes"); }}>Allow</Button>
      </div>
    </div>
  );
}
