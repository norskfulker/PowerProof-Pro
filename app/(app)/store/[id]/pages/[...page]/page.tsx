"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { StoreInfoEditor } from "@/components/store-admin/store-info-editor";
import type { StorePageKey } from "@/lib/types";

const KEYS: StorePageKey[] = ["about", "faq", "refund", "terms", "privacy"];

/** /store/[id]/pages/about, /faq, /policies/refund (or /refund), /terms, /privacy */
export default function StorePageRoute({ params }: { params: Promise<{ id: string; page: string[] }> }) {
  const { id, page } = use(params);
  const key = (page[0] === "policies" ? page[1] : page[0]) as StorePageKey;
  if (!KEYS.includes(key) || page.length > (page[0] === "policies" ? 2 : 1)) notFound();
  return <StoreInfoEditor storeId={id} page={key} />;
}
