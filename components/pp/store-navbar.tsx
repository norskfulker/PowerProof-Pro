"use client";

import { MediaImg } from "@/components/media/tile-background";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { targetHref } from "@/lib/store-themes";
import type { Collection, HeaderSettings, Store } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  header = {},
}: {
  store: Store;
  collections: Collection[];
  header?: HeaderSettings;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const base = `/s/${store.slug}`;
  const custom = header.links?.filter((l) => l.label.trim());
  const links = custom?.length
    ? custom.map((l) => ({ href: targetHref(store.slug, l.target), label: l.label }))
    : [{ href: `${base}/products`, label: "All products" }, ...collections.slice(0, 4).map((c) => ({ href: `${base}/c/${c.slug}`, label: c.name })), { href: `${base}/contact`, label: "Contact" }];
  const centered = header.align === "center";
  const searchOn = header.search !== false;
  // Links to other sites open in a new tab
  const MenuLink = ({ href, className, onClick, children }: { href: string; className: string; onClick?: () => void; children: React.ReactNode }) =>
    /^(https:|mailto:)/i.test(href) ? <a href={href} className={className} onClick={onClick} target="_blank" rel="noopener noreferrer">{children}</a> : <Link href={href} className={className} onClick={onClick}>{children}</Link>;

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(`${base}/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  return (
    <header className={cn("z-30 border-b bg-surface/95 backdrop-blur", header.sticky !== false && "sticky top-0")}>
      <div className={cn("mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 md:px-6", centered && "relative justify-center")}>
        <Link href={base} className="flex min-h-11 min-w-0 items-center rounded-control" aria-label={`${store.name} home`}>
          <StoreLogo store={store} />
        </Link>
        {searchOn && <form role="search" onSubmit={search} className={cn("relative hidden w-full max-w-xs md:block", centered ? "absolute right-6" : "ml-auto")}>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${store.name}`} aria-label="Search products" className="h-10 pl-10 pointer-coarse:h-11" />
        </form>}
        {/* The search box pushes the menu button to the right; without it the button keeps its own space */}
        <div className={cn("flex items-center gap-2", centered ? "absolute right-4 md:hidden" : searchOn ? "ml-auto md:ml-0" : "ml-auto")}>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-6">
              <SheetTitle className="sr-only">Store menu</SheetTitle>
              <StoreLogo store={store} />
              {searchOn && <form role="search" onSubmit={search} className="relative mt-6">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="pl-10" />
              </form>}
              <nav aria-label="Store" className="mt-4">
                <ul className="flex flex-col">
                  {links.map((l) => (
                    <li key={l.href}>
                      <MenuLink href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-control px-2 font-display text-lg hover:bg-muted">{l.label}</MenuLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <nav aria-label="Collections" className="hidden border-t lg:block">
        <ul className={cn("mx-auto flex max-w-[1200px] items-center gap-2 px-4 md:px-6", centered && "justify-center")}>
          {links.map((l) => (
            <li key={l.href}>
              <MenuLink href={l.href} className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground">{l.label}</MenuLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
