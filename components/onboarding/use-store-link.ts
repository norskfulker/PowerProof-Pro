"use client";

import { useEffect, useState } from "react";
import { checkSlug, suggestSlug } from "@/lib/api";
import { cleanStoreName, storeNameError } from "@/lib/slug";

type LinkState = { for: string; slug?: string; available?: boolean; failed?: boolean };

/**
 * The store link for a name, as the creator types it. The link comes from the database, never from
 * the browser (length limit, reserved words, collisions, non-Latin names), and the database then
 * confirms it's free. Off when `enabled` is false (a store that already has its link).
 */
export function useStoreLink(name: string, enabled = true) {
  const [link, setLink] = useState<LinkState | null>(null);
  const clean = cleanStoreName(name ?? "");
  const valid = enabled && storeNameError(clean) === null;

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const slug = await suggestSlug(clean);
        if (alive) setLink({ for: clean, slug });
        const r = await checkSlug(slug);
        if (alive) setLink({ for: clean, slug, available: r.available });
      } catch {
        if (alive) setLink({ for: clean, failed: true });
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [clean, valid]);

  const current = valid && link?.for === clean ? link : null;
  const waiting = valid && (!current || (current.slug !== undefined && current.available === undefined && !current.failed));
  return { current, waiting, ready: Boolean(current?.slug && current.available), valid };
}
