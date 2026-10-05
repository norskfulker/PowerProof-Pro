"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useStorefront } from "@/components/storefront/storefront-context";

const TITLES = { refund: "Refund policy", terms: "Terms of sale", privacy: "Privacy policy" } as const;
type PolicyKey = keyof typeof TITLES;

export default function PolicyPage({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = use(params);
  const { view, slug } = useStorefront();
  if (!(policy in TITLES)) notFound();
  const key = policy as PolicyKey;
  return (
    <article className="mx-auto max-w-[760px] px-4 pt-10 md:px-6 md:pt-16">
      <title>{`${TITLES[key]} · ${view.store.name}`}</title>
      <nav aria-label="Policies" className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(TITLES) as PolicyKey[]).map((k) => (
          <Link key={k} href={`/s/${slug}/policies/${k}`} aria-current={k === key ? "page" : undefined} className={k === key ? "inline-flex min-h-11 items-center rounded-control bg-primary-soft px-3 text-sm font-semibold text-primary" : "inline-flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-muted"}>
            {TITLES[k]}
          </Link>
        ))}
      </nav>
      <h1 className="text-[36px] leading-tight md:text-5xl">{TITLES[key]}</h1>
      <p className="mt-6 text-lg leading-relaxed whitespace-pre-line text-foreground/85">{view.pages[key]}</p>
      <p className="mt-8 text-sm text-muted-foreground">
        Questions? Write to <a href={`mailto:${view.store.supportEmail}`} className="underline underline-offset-4">{view.store.supportEmail}</a>.
      </p>
    </article>
  );
}
