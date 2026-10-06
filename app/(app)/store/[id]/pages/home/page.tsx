"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, LayoutList, Megaphone, PanelTop, Search } from "lucide-react";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getStore } from "@/lib/api";

/** Store › Pages › Home. The store home is built from sections in Design; this is the way in. */
export default function StoreHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useApi(getStore, []);
  const LINKS = [
    { href: `/store/${id}/design/backgrounds`, icon: PanelTop, title: "Headline, button and background", body: "The first thing buyers see: words, one button and an image, GIF or video." },
    { href: `/store/${id}/design/sections`, icon: LayoutList, title: "Sections", body: "Turn sections on or off and put them in order: collections, bestsellers, reviews and more." },
    { href: `/store/${id}/design/content`, icon: Megaphone, title: "Announcement and newsletter", body: "The bar across the top and the sign-up box near the bottom." },
    { href: `/store/${id}/seo`, icon: Search, title: "Search and social", body: "The title and description Google and link previews show." },
  ];
  return (
    <>
      <title>Home page · PowerProof</title>
      <PageHeader
        title="Home page"
        description="Your store's front page. It's made from sections, so it always looks right on phones."
        actions={store.data && (
          <Button asChild variant="secondary">
            <Link href={`/s/${store.data.slug}`} target="_blank">View it <ExternalLink aria-hidden /></Link>
          </Button>
        )}
      />
      <ul className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group flex h-full flex-col gap-2 rounded-card border bg-surface p-5 transition-colors hover:border-border-strong">
              <span className="grid size-10 place-items-center rounded-control bg-primary-soft text-primary"><l.icon className="size-5" aria-hidden /></span>
              <span className="font-semibold">{l.title}</span>
              <span className="flex-1 text-sm text-muted-foreground">{l.body}</span>
              <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
