"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { OffersManager, type OfferSection } from "@/components/store-admin/offers-manager";

const SECTIONS: OfferSection[] = ["coupons", "bundles", "deals"];

export default function OffersPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = use(params);
  if (!SECTIONS.includes(section as OfferSection)) notFound();
  return <OffersManager storeId={id} section={section as OfferSection} />;
}
