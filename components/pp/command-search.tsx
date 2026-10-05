"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Receipt, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getCustomers, getOrders, getProducts } from "@/lib/api";
import type { Customer, Order, Product } from "@/lib/types";
import { CREATOR_NAV } from "./nav-config";

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ products: Product[]; orders: Order[]; customers: Customer[] }>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || data) return;
    Promise.all([getProducts(), getOrders({ limit: 20 }), getCustomers()])
      .then(([products, orders, customers]) => setData({ products, orders, customers }))
      .catch(() => setData({ products: [], orders: [], customers: [] }));
  }, [open, data]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className="w-full max-w-sm justify-start font-normal text-muted-foreground max-sm:hidden"
        aria-label="Search (Ctrl K)"
      >
        <Search aria-hidden />
        Search products, orders, people
        <kbd className="ml-auto rounded-[4px] border bg-surface-sunken px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <Search />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page, product, order or customer">
        <CommandInput placeholder="Type to search…" />
        <CommandList>
          <CommandEmpty>{data ? "Nothing found." : "Loading…"}</CommandEmpty>
          <CommandGroup heading="Go to">
            {CREATOR_NAV.flatMap((g) => g.items)
              .filter((i) => !i.soon)
              .map((i) => (
                <CommandItem key={i.href} onSelect={() => go(i.href)}>
                  <i.icon aria-hidden /> {i.label}
                </CommandItem>
              ))}
          </CommandGroup>
          {data && (
            <>
              <CommandGroup heading="Products">
                {data.products.map((p) => (
                  <CommandItem key={p.id} value={`product ${p.title} ${p.sku}`} onSelect={() => go(`/products/${p.id}`)}>
                    <Package aria-hidden /> {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Recent orders">
                {data.orders.map((o) => (
                  <CommandItem key={o.id} value={`order ${o.number} ${o.buyerEmail}`} onSelect={() => go(`/orders/${o.id}`)}>
                    <Receipt aria-hidden /> <span className="font-mono text-xs">{o.number}</span> {o.buyerName || "Pending"}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Customers">
                {data.customers.map((c) => (
                  <CommandItem key={c.id} value={`customer ${c.name} ${c.email}`} onSelect={() => go(`/customers/${c.id}`)}>
                    <Users aria-hidden /> {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
