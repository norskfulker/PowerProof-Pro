"use client";

import Link from "next/link";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { useStorefront } from "@/components/storefront/storefront-context";

export default function StoreFaqPage() {
  const { view } = useStorefront();
  return (
    <div className="mx-auto max-w-[820px] px-4 pt-10 md:px-6 md:pt-16">
      <title>{`FAQ · ${view.store.name}`}</title>
      <h1 className="text-[40px] leading-tight md:text-5xl">Questions, answered.</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Can&apos;t find yours? <Link href={`/s/${view.store.slug}/contact`} className="font-medium text-foreground underline underline-offset-4">Ask {view.design.about.name.split(" ")[0]}</Link>.
      </p>
      <FaqAccordion items={view.pages.faq} className="mt-8" />
    </div>
  );
}
