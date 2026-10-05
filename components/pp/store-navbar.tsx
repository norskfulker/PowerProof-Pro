"use client";

import { MediaImg } from "@/components/media/tile-background";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Collection, CurrencyCode, Store } from "@/lib/types";
import { CurrencyPicker } from "@/components/buyer/buyer-shell";

export function StoreLogo({ store }: { store: Store }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {store.logo?.src ? (
        <span className="relative size-9 shrink-0 overflow-hidden rounded-[10px]"><MediaImg src={store.logo.src} alt="" decorative className="absolute inset-0" /></span>
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary font-mono text-xs font-semibold text-primary-foreground">{store.logoText}</span>
      )}
      <span className="truncate font-display text-lg">{store.name}</span>
    </span>
  );
}

/** Store top bar: logo, search, collections, contact. No login, no cart (digital stores). */
export function StoreNavbar({
  store,
  collections,
  currency,
  onCurrency,
}: {
  store: Store;
  collections: Collection[];
  currency: CurrencyCode;
  onCurrency: (c: CurrencyCode) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const base = `/s/${store.slug}`;
  const links = [{ href: `${base}/products`, label: "All products" }, ...collections.slice(0, 4).map((c) => ({ href: `${base}/c/${c.slug}`, label: c.name })), { href: `${base}/contact`, label: "Contact" }];

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(`${base}/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 md:px-6">
        <Link href={base} className="flex min-h-11 min-w-0 items-center rounded-control" aria-label={`${store.name} home`}>
          <StoreLogo store={store} />
        </Link>
        <form role="search" onSubmit={search} className="relative ml-auto hidden w-full max-w-xs md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${store.name}`} aria-label="Search products" className="h-10 pl-10 pointer-coarse:h-11" />
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <CurrencyPicker value={currency} onChange={onCurrency} />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-6">
              <SheetTitle className="sr-only">Store menu</SheetTitle>
              <StoreLogo store={store} />
              <form role="search" onSubmit={search} className="relative mt-6">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="pl-10" />
              </form>
              <nav aria-label="Store" className="mt-4">
                <ul className="flex flex-col">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-control px-2 font-display text-lg hover:bg-muted">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <nav aria-label="Collections" className="hidden border-t lg:block">
        <ul className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 md:px-6">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground">{l.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
