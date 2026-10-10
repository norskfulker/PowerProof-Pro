"use client";

import { use } from "react";
import { notFound, redirect } from "next/navigation";
import { pageHref, StoreInfoEditor } from "@/components/store-admin/store-info-editor";

const POLICIES = ["refund", "terms", "privacy"] as const;

/**
 * /store/[id]/pages/policies/refund (or /refund), /terms, /privacy. About and FAQ moved into the
 * store editor; their old addresses open it there.
 */
export default function StorePageRoute({ params }: { params: Promise<{ id: string; page: string[] }> }) {
  const { id, page } = use(params);
  const key = page[0] === "policies" ? page[1] : page[0];
  if ((key === "about" || key === "faq") && page.length === 1) redirect(pageHref(id, key));
  const policy = POLICIES.find((k) => k === key);
  if (!policy || page.length > (page[0] === "policies" ? 2 : 1)) notFound();
  return <StoreInfoEditor storeId={id} page={policy} />;
}
