"use client";

import { MediaImg } from "@/components/media/tile-background";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { targetHref } from "@/lib/store-themes";
import type { Collection, HeaderSettings, Store } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Logo frame sizes: height, and the width for the square and wide (16:9) frames */
const LOGO_FRAME = {
  sm: { h: "h-7", square: "w-7", wide: "w-[3.125rem]", natural: "max-w-32" },
  md: { h: "h-9", square: "w-9", wide: "w-16", natural: "max-w-44" },
  lg: { h: "h-12", square: "w-12", wide: "w-[5.25rem]", natural: "max-w-56" },
} as const;

export function StoreLogo({ store, header }: { store: Store; header?: HeaderSettings }) {
  const shape = header?.logoShape ?? "1:1";
  const size = LOGO_FRAME[header?.logoSize ?? "md"];
  const showName = header?.showName !== false;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {store.logo?.src ? (
        shape === "auto" ? (
          // The picture's own proportions: the frame extends to its width
          <span className={cn("flex shrink-0 items-center", size.h, size.natural)}><MediaImg src={store.logo.src} alt="" decorative fit="contain" className={cn("w-auto max-w-full", size.h)} /></span>
        ) : (
          <span className={cn("relative shrink-0 overflow-hidden", size.h, shape === "16:9" ? cn(size.wide, "rounded-[6px]") : cn(size.square, "rounded-[10px]"))}><MediaImg src={store.logo.src} alt="" decorative fit={header?.logoFit ?? "cover"} className="absolute inset-0" /></span>
        )
      ) : (
        <span className={cn("grid shrink-0 place-items-center rounded-[10px] bg-primary font-mono text-xs font-semibold text-primary-foreground", size.h, size.square)}>{store.logoText}</span>
      )}
      {showName && <span className="truncate font-display text-lg">{store.name}</span>}
    </span>
  );
}

/**
 * Store top bar, one row: logo, the menu links, search. The menu button appears only when it's
 * needed: on phones, or when the links don't fit the row. People who work on the store also get a
 * way back to their dashboard. No login, no cart.
 */
export function StoreNavbar({
  store,
  collections,
  header = {},
  manage,
}: {
  store: Store;
  collections: Collection[];
  header?: HeaderSettings;
  /** Shown to the store's owner and team: back to the dashboard (switching to this store) */
  manage?: () => void;
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
  // Do the links fit beside the logo and search? If not, they move into the menu
  const navRef = useRef<HTMLUListElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => setFits(el.scrollWidth <= el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [links.length]);
  // Links to other sites open in a new tab
  const MenuLink = ({ href, className, onClick, children }: { href: string; className: string; onClick?: () => void; children: React.ReactNode }) =>
    /^(https:|mailto:)/i.test(href) ? <a href={href} className={className} onClick={onClick} target="_blank" rel="noopener noreferrer">{children}</a> : <Link href={href} className={className} onClick={onClick}>{children}</Link>;

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(`${base}/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  const logo = (
    <Link href={base} className="flex min-h-11 min-w-0 shrink-0 items-center rounded-control" aria-label={`${store.name} home`}>
      <StoreLogo store={store} header={header} />
    </Link>
  );
  const inline = (
    <nav aria-label="Store" className={cn("hidden min-w-0 flex-1 md:block", centered && "order-first")}>
      <ul ref={navRef} className={cn("flex items-center gap-1 overflow-hidden", !fits && "invisible")} aria-hidden={!fits || undefined}>
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <MenuLink href={l.href} className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium whitespace-nowrap text-foreground/80 hover:bg-muted hover:text-foreground">{l.label}</MenuLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <header className={cn("z-30 border-b bg-surface/95 backdrop-blur", header.sticky !== false && "sticky top-0")}>
      <div className={cn("mx-auto flex h-16 max-w-[calc(72rem*var(--pp-measure,1))] items-center gap-3 px-4 md:gap-4 md:px-6")}>
        {centered ? (
          <>
            {inline}
            <div className="flex min-w-0 justify-center max-md:flex-1 max-md:justify-start">{logo}</div>
          </>
        ) : (
          <>
            {logo}
            {inline}
          </>
        )}
        <div className={cn("ml-auto flex shrink-0 items-center gap-2", centered && "md:flex-1 md:justify-end")}>
          {searchOn && (
            <form role="search" onSubmit={search} className="relative hidden w-56 md:block lg:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${store.name}`} aria-label="Search products" className="h-10 pl-10 pointer-coarse:h-11" />
            </form>
          )}
          {manage && (
            <Button type="button" variant="secondary" size="sm" onClick={manage} className="hidden md:inline-flex">
              <LayoutDashboard aria-hidden /> Dashboard
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              {/* On phones always (links and search live here); on wider screens only when the links don't fit */}
              <Button variant="ghost" size="icon" className={cn(fits && "md:hidden")} aria-label="Open menu"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-6">
              <SheetTitle className="sr-only">Store menu</SheetTitle>
              <StoreLogo store={store} header={header} />
              {searchOn && <form role="search" onSubmit={search} className="relative mt-6 md:hidden">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="pl-10" />
              </form>}
              <nav aria-label="Store menu" className="mt-4">
                <ul className="flex flex-col">
                  {links.map((l) => (
                    <li key={l.href}>
                      <MenuLink href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-control px-2 font-display text-lg hover:bg-muted">{l.label}</MenuLink>
                    </li>
                  ))}
                </ul>
              </nav>
              {manage && (
                <Button type="button" variant="secondary" className="mt-6 w-full md:hidden" onClick={() => { setOpen(false); manage(); }}>
                  <LayoutDashboard aria-hidden /> Back to dashboard
                </Button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
