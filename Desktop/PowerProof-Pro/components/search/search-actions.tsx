"use client";

import { useRouter } from "next/navigation";
import { copyText } from "@/components/pp/copy-field";
import type { QuickAction, SearchResult } from "@/lib/types";

export const contactKey = (r: SearchResult, field: "email" | "phone") => `${r.type}:${r.id}:${field}`;

/**
 * Actions for search results in the palette. Creators only open or copy: their own buyers'
 * contact details are never masked, so there is nothing to reveal. (The founder admin search,
 * with masked contacts and audited actions, isn't connected yet.)
 */
export function useSearchActions(_onChanged?: () => void) {
  const router = useRouter();

  function run(action: QuickAction, result: SearchResult) {
    if (action === "open") return router.push(result.href);
    if (action === "copy") return void copyText(result.id, `Copied ${result.id}`);
  }

  const askReveal = (_result: SearchResult, _field: "email" | "phone") => undefined;
  const revealed: Record<string, string> = {};
  return { run, askReveal, revealed, dialogs: null };
}
