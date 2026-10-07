"use client";

import { readableOn } from "@/lib/color";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PlanUsage } from "@/components/plan/plan-usage";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, ExternalLink, SunMoon, ListChecks, Loader2, LogOut, Plus, Settings, Shield, Sparkles } from "lucide-react";
import { useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { usePlan } from "@/components/plan/plan-context";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { createOwnedStore, getOwnedStores, logout, switchStore } from "@/lib/api";
import { initials } from "@/lib/format";
import { GlobalSearch } from "@/components/search/global-search";
import { Notifications } from "./notifications";

function NewStoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const plan = usePlan();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Open another store</DialogTitle>
          <DialogDescription>Each store has its own products, design, About page, FAQ and policies. Payouts and your login are shared.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(undefined);
            try {
              const s = await createOwnedStore({ name });
              await switchStore(s.id);
              onOpenChange(false);
              setName("");
              toast.success(`${s.name} is ready`, { description: "Default About, FAQ and policies are filled in. Make them yours." });
              router.push("/dashboard");
              router.refresh();
            } catch (err) {
              if (!plan.handleLimitError(err)) setError(err instanceof Error ? err.message : "Couldn't create the store.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ns-name">Store name</Label>
            <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your store name" aria-invalid={!!error || undefined} aria-describedby={error ? "ns-err" : undefined} />
            {error && <p id="ns-err" className="text-sm font-medium text-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Create store</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoreSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const plan = usePlan();
  const unsaved = useUnsavedGuard();
  const { data: store } = useCurrentStore();
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="max-w-56 min-w-0 shrink gap-2.5 px-2" aria-label={`Store: ${store?.name ?? "loading"}. Switch store`}>
            <span className="grid size-7 shrink-0 place-items-center rounded-[8px] font-mono text-[0.6875rem] font-semibold" style={{ background: store?.brandColor ?? "var(--primary)", color: store?.brandColor ? readableOn(store.brandColor) : "var(--primary-foreground)" }}>
              {store?.logoText ?? "··"}
            </span>
            <span className="truncate max-sm:hidden">{store?.name ?? "Loading…"}</span>
            <ChevronsUpDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="eyebrow">Your stores</DropdownMenuLabel>
          {stores?.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onSelect={() =>
                !s.active &&
                unsaved.confirmLeave(async () => {
                  await switchStore(s.id);
                  toast.success(`Switched to ${s.name}`);
                  // On a store screen, stay on the same screen for the other store
                  const m = pathname.match(/^\/store\/[^/]+(\/.*)?$/);
                  if (m) router.push(`/store/${s.id}${m[1] ?? ""}`);
                  else router.refresh();
                })
              }
            >
              {s.active ? <Check aria-hidden /> : <span className="size-4" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="font-mono text-[0.625rem] text-muted-foreground">{s.products} products</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => plan.guard("stores", () => setCreating(true))}>
            <Plus aria-hidden /> Add another store
            {plan.state?.tier === "free" && <span className="ml-auto font-mono text-[0.625rem]">PRO</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {store && (
            <DropdownMenuItem asChild>
              <Link href={`/s/${store.slug}`} target="_blank">
                <ExternalLink aria-hidden /> View live store
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <NewStoreDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function AccountMenu() {
  const router = useRouter();
  const gs = useGettingStarted();
  const { data: store } = useCurrentStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <Avatar className="size-9">
            <AvatarFallback className="bg-accent-soft font-semibold text-accent-ink">{initials(store?.ownerName ?? "")}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block">{store?.ownerName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{store?.ownerEmail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <PlanUsage className="border-0 p-0" />
        </div>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">
            <Sparkles aria-hidden /> Billing and plan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <Settings aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => gs.openDrawer()}>
          <ListChecks aria-hidden /> Getting started checklist
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <Shield aria-hidden /> Founder admin
          </Link>
        </DropdownMenuItem>
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm"><SunMoon className="size-4" aria-hidden /> Colour mode</span>
          <ThemeToggle iconOnly />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            router.push("/login");
          }}
        >
          <LogOut aria-hidden /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ admin }: { admin?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur md:px-6">
      {admin ? (
        <p className="font-display text-lg">Founder admin</p>
      ) : (
        <StoreSwitcher />
      )}
      <div className="flex flex-1 justify-end md:justify-center">
        <GlobalSearch scope={admin ? "admin" : "creator"} />
      </div>
      {!admin && <Notifications />}
      <AccountMenu />
    </header>
  );
}
