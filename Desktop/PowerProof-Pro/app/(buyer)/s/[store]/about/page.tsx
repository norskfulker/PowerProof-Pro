"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MediaImg } from "@/components/media/tile-background";
import { useStorefront } from "@/components/storefront/storefront-context";
import { formatNumber } from "@/lib/format";

export default function StoreAboutPage() {
  const { view } = useStorefront();
  const { about, socials } = view.design;
  const links = Object.entries(socials).filter(([, v]) => v) as [string, string][];
  return (
    <article className="mx-auto max-w-[760px] px-4 pt-10 md:px-6 md:pt-16">
      <title>{`About · ${view.store.name}`}</title>
      {about.photo?.src ? (
        <span className="relative block size-28 overflow-hidden rounded-full border bg-muted">
          <MediaImg src={about.photo.src} alt={about.photo.alt || `Photo of ${about.name}`} focal={about.photo.focal} className="absolute inset-0" />
        </span>
      ) : (
        <Avatar className="size-28"><AvatarFallback className="bg-accent-soft font-display text-4xl text-accent-ink">{about.initials}</AvatarFallback></Avatar>
      )}
      <h1 className="mt-2 text-[2.5rem] leading-tight md:text-5xl">Hi, I&apos;m {about.name.split(" ")[0]}.</h1>
      <p className="mt-5 text-lg leading-relaxed whitespace-pre-line text-foreground/85">{about.story}</p>
      <dl className="mt-8 grid grid-cols-2 gap-3">
        {[
          ["Products", formatNumber(view.products.length)],
          ["Rating", view.rating.count ? view.rating.average.toFixed(1) : "New"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border bg-surface p-4">
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 font-display text-2xl">{v}</dd>
          </div>
        ))}
      </dl>
      {links.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {links.map(([k, v]) => (
            <li key={k}><a href={v} target="_blank" rel="noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border bg-surface px-4 text-sm font-medium capitalize hover:border-border-strong">{k === "x" ? "X" : k}</a></li>
          ))}
        </ul>
      )}
    </article>
  );
}
