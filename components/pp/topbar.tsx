"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, ExternalLink, FlaskConical, ListChecks, Loader2, LogOut, Plus, Settings, Shield } from "lucide-react";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApi } from "@/hooks/use-api";
import { createOwnedStore, getDemoState, getOwnedStores, getStore, loadSampleData, loadStressData, logout, setDemoState, startEmptyStore, switchStore } from "@/lib/api";
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
            <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ananya Photo Presets" aria-invalid={!!error || undefined} aria-describedby={error ? "ns-err" : undefined} />
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
  const plan = usePlan();
  const unsaved = useUnsavedGuard();
  const { data: store } = useApi(getStore, [], { live: true });
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="max-w-56 min-w-0 shrink gap-2.5 px-2" aria-label={`Store: ${store?.name ?? "loading"}. Switch store`}>
            <span className="grid size-7 shrink-0 place-items-center rounded-[8px] font-mono text-[0.6875rem] font-semibold text-white" style={{ background: store?.brandColor ?? "var(--primary)" }}>
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
                  router.refresh();
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
  const { data: store } = useApi(getStore, [], { live: true });
  const [demo, setDemo] = useState<ReturnType<typeof getDemoState>>();

  return (
    <DropdownMenu onOpenChange={(o) => o && setDemo(getDemoState())}>
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FlaskConical aria-hidden /> Demo data
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuLabel className="eyebrow">Currently: {demo?.mode === "fresh" ? "empty store" : demo?.mode === "stress" ? "stress data" : "sample data"}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => {
                loadSampleData();
                toast.success("Sample data loaded");
                router.refresh();
              }}
            >
              Load sample data
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                startEmptyStore();
                toast.success("Store emptied", { description: "See every empty state." });
              }}
            >
              Start with an empty store
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                loadStressData();
                toast.success("Stress data loaded", { description: "Long names, 500 products, 5000 reviews." });
                router.refresh();
              }}
            >
              Load stress data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={demo?.fail ?? false}
              onCheckedChange={(v) => {
                setDemoState({ fail: !!v });
                setDemo(getDemoState());
                toast(v ? "Errors on. Reload a page to see error states." : "Errors off.");
              }}
            >
              Simulate errors
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
