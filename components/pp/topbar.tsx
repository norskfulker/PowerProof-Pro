"use client";

import { readableOn } from "@/lib/color";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Coins, ExternalLink, SunMoon, ListChecks, Loader2, LogOut, Pencil, Plus, Settings, Shield, Sparkles } from "lucide-react";
import { useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { usePlan } from "@/components/plan/plan-context";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { PlanUsage } from "@/components/plan/plan-usage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { createOwnedStore, getOwnedStores, getWorkspaceCredits, getWorkspaces, logout, renameWorkspace, switchStore, WORKSPACE_NAME_MAX } from "@/lib/api";
import { can, roleLabel } from "@/lib/team";
import { formatNumber, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/search/global-search";
import { Notifications } from "./notifications";

type StoreDialog = { kind: "store" } | { kind: "workspace" } | { kind: "rename"; name: string } | null;

/** Add a store to this workspace, start a new workspace (with its first store), or rename this one */
function WorkspaceDialog({ open, onOpenChange }: { open: StoreDialog; onOpenChange: (o: StoreDialog) => void }) {
  const router = useRouter();
  const plan = usePlan();
  const [workspace, setWorkspace] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState<StoreDialog>(null);
  // Fresh fields each time it opens
  if (open !== shown) {
    setShown(open);
    setWorkspace(open?.kind === "rename" ? open.name : "");
    setName("");
    setError(undefined);
  }
  const kind = open?.kind;
  const title = kind === "workspace" ? "New workspace" : kind === "rename" ? "Rename workspace" : "Add a store";
  const description =
    kind === "workspace"
      ? "A workspace holds its own stores, team and agent credits. Start it with its first store."
      : kind === "rename"
        ? "Everyone in the workspace sees the new name."
        : "Each store has its own products, design, About page, FAQ and policies. The workspace's team, agents and credits are shared.";
  return (
    <Dialog open={!!open} onOpenChange={(o) => !pending && !o && onOpenChange(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(undefined);
            try {
              if (kind === "rename") {
                await renameWorkspace(workspace);
                toast.success("Workspace renamed");
                onOpenChange(null);
                router.refresh();
                return;
              }
              const s = await createOwnedStore({ name, workspaceName: kind === "workspace" ? workspace : undefined });
              await switchStore(s.id);
              onOpenChange(null);
              toast.success(kind === "workspace" ? `${workspace.trim()} is ready` : `${s.name} is ready`, { description: "Default About, FAQ and policies are filled in. Make them yours." });
              router.push("/dashboard");
              router.refresh();
            } catch (err) {
              if (!plan.handleLimitError(err)) setError(err instanceof Error ? err.message : "That didn't save. Try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          {kind !== "store" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={workspace} maxLength={WORKSPACE_NAME_MAX} onChange={(e) => setWorkspace(e.target.value)} placeholder="Your business or team" aria-invalid={!!error || undefined} aria-describedby={error ? "ws-err" : undefined} />
            </div>
          )}
          {kind !== "rename" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ns-name">{kind === "workspace" ? "First store name" : "Store name"}</Label>
              <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your store name" aria-invalid={!!error || undefined} aria-describedby={error ? "ws-err" : undefined} />
            </div>
          )}
          {error && <p id="ws-err" className="text-sm font-medium text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(null)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} {kind === "rename" ? "Save" : kind === "workspace" ? "Create workspace" : "Create store"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Workspace › store: switch either, add a store, start or rename a workspace */
function WorkspaceSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const plan = usePlan();
  const unsaved = useUnsavedGuard();
  const { data: store } = useCurrentStore();
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const { data: workspaces } = useApi(getWorkspaces, [], { live: true });
  const [dialog, setDialog] = useState<StoreDialog>(null);
  const active = workspaces?.find((w) => w.active);
  const here = (stores ?? []).filter((s) => s.workspaceId === active?.id);
  const owner = active?.access.role === "owner";

  const open = (storeId: string, name: string) =>
    unsaved.confirmLeave(async () => {
      await switchStore(storeId);
      toast.success(`Switched to ${name}`);
      // On a store screen, stay on the same screen for the other store
      const m = pathname.match(/^\/store\/[^/]+(\/.*)?$/);
      if (m) router.push(`/store/${storeId}${m[1] ?? ""}`);
      else router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="max-w-72 min-w-0 shrink gap-2.5 px-2" aria-label={`Workspace: ${active?.name ?? "loading"}, store: ${store?.name ?? "loading"}. Switch`}>
            <span className="grid size-7 shrink-0 place-items-center rounded-[8px] font-mono text-[0.6875rem] font-semibold" style={{ background: store?.brandColor ?? "var(--primary)", color: store?.brandColor ? readableOn(store.brandColor) : "var(--primary-foreground)" }}>
              {store?.logoText ?? "··"}
            </span>
            <span className="flex min-w-0 flex-col items-start leading-tight max-sm:hidden">
              <span className="max-w-full truncate text-[0.6875rem] font-normal text-muted-foreground">{active?.name ?? "Workspace"}</span>
              <span className="max-w-full truncate">{store?.name ?? "Loading…"}</span>
            </span>
            <ChevronsUpDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="eyebrow">Stores in {active?.name ?? "this workspace"}</DropdownMenuLabel>
          {here.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => !s.active && open(s.id, s.name)}>
              {s.active ? <Check aria-hidden /> : <span className="size-4" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="font-mono text-[0.625rem] text-muted-foreground">{s.products} products</span>
            </DropdownMenuItem>
          ))}
          {owner && (
            <DropdownMenuItem onSelect={() => plan.guard("stores", () => setDialog({ kind: "store" }))}>
              <Plus aria-hidden /> Add a store
              {plan.state?.tier === "free" && <span className="ml-auto font-mono text-[0.625rem]">PRO</span>}
            </DropdownMenuItem>
          )}
          {store && (
            <DropdownMenuItem asChild>
              <Link href={`/s/${store.slug}`} target="_blank">
                <ExternalLink aria-hidden /> View live store
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="eyebrow">Workspaces</DropdownMenuLabel>
          {workspaces?.map((w) => {
            const first = stores?.find((s) => s.workspaceId === w.id);
            return (
              <DropdownMenuItem key={w.id} disabled={!w.active && !first} onSelect={() => !w.active && first && open(first.id, w.name)}>
                {w.active ? <Check aria-hidden /> : <span className="size-4" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                <span className="font-mono text-[0.625rem] text-muted-foreground">{w.access.role === "owner" ? `${w.stores} ${w.stores === 1 ? "store" : "stores"}` : roleLabel(w.access.role)}</span>
              </DropdownMenuItem>
            );
          })}
          {active && can(active.access, "team") && (
            <DropdownMenuItem onSelect={() => setDialog({ kind: "rename", name: active.name })}>
              <Pencil aria-hidden /> Rename workspace
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => plan.guard("stores", () => setDialog({ kind: "workspace" }))}>
            <Plus aria-hidden /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WorkspaceDialog open={dialog} onOpenChange={setDialog} />
    </>
  );
}

/**
 * The workspace's agent credits (one pool for all its stores). Hover or tap for the balance, what
 * a credit buys, and buying more.
 */
function CreditsChip() {
  const { data: store } = useCurrentStore();
  const { data } = useApi(getWorkspaceCredits, [store?.workspaceId], { live: true });
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (data === undefined) return null;
  const label = `${formatNumber(data)} ${data === 1 ? "credit" : "credits"}`;
  // Opens on hover with a short grace period, so the pointer can travel into the card
  const hover = (o: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(o), o ? 80 : 160);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="rounded-full font-mono" aria-label={`Agent credits: ${label}`} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
          <Coins aria-hidden className={cn(data <= 0 && "text-warning-ink")} />
          <span className="max-sm:sr-only">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
        <p className="text-sm text-muted-foreground">Balance available</p>
        <p className="font-display text-3xl font-bold tracking-[-0.03em] tabular">{formatNumber(data)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared by every store and agent in {store?.workspaceName ?? "this workspace"}. One credit pays for one action, like one message sent. At zero, agents pause.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button disabled aria-describedby="credits-soon">
            <Plus aria-hidden /> Buy more credits
          </Button>
          <p id="credits-soon" className="text-center text-xs text-muted-foreground">Credit packs open soon.</p>
          {can(store?.access, "agents") && (
            <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <Link href="/agents/my">See agents and usage</Link>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Profile, settings, colour mode and log out. `row` is the sidebar's own line with the name and email. */
export function AccountMenu({ variant = "avatar" }: { variant?: "avatar" | "row" }) {
  const router = useRouter();
  const gs = useGettingStarted();
  const { data: store } = useCurrentStore();
  const { state: planState, upgrade } = usePlan();
  const pro = planState?.tier === "pro";
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ isAdmin: boolean }> : { isAdmin: false })
      .then((result) => { if (active) setIsAdmin(result.isAdmin); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, []);

  const avatar = (
    <Avatar className={variant === "row" ? "size-8" : "size-9"}>
      <AvatarFallback className="bg-accent-soft font-semibold text-accent-ink">{initials(store?.ownerName ?? "")}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "row" ? (
          <Button variant="ghost" size="lg" className="w-full justify-start gap-2.5 px-2" aria-label={`Account menu, ${pro ? "Pro" : "Free"} plan`}>
            {avatar}
            <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <span className="max-w-full truncate text-sm font-semibold">{store?.ownerName}</span>
              {!pro && planState && !planState.joined && <span className="text-xs font-medium text-accent-ink">Pro available</span>}
            </span>
            {planState && <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", pro ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{pro ? "Pro" : "Free"}</span>}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">{avatar}</Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={variant === "row" ? "right" : "bottom"} sideOffset={variant === "row" ? 12 : 4} className="w-64">
        <DropdownMenuLabel>
          <span className="block">{store?.ownerName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{store?.ownerEmail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* The plan's limits (the owner's plan in a workspace someone else owns) */}
        <div className="px-2 py-1.5">
          <PlanUsage className="border-0 p-0" />
        </div>
        {!pro && planState && !planState.joined && (
          <DropdownMenuItem onSelect={() => upgrade()}>
            <Sparkles aria-hidden /> Upgrade to Pro
          </DropdownMenuItem>
        )}
        {pro && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/settings/billing">
                <Sparkles aria-hidden /> Billing and plan
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <Settings aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => gs.openDrawer()}>
          <ListChecks aria-hidden /> Getting started checklist
        </DropdownMenuItem>
        {isAdmin && <DropdownMenuItem asChild>
          <Link href="/admin">
            <Shield aria-hidden /> Founder admin
          </Link>
        </DropdownMenuItem>}
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

/**
 * The top bar: workspace › store on the left, search, then the workspace's agent credits.
 * Notifications and the account live in the sidebar (on phones, where the sidebar is a sheet,
 * they stay here too). The dashboard has its own big search box, so the bar leaves it out there.
 */
export function Topbar({ admin, className }: { admin?: boolean; className?: string }) {
  const onDashboard = usePathname() === "/dashboard";
  return (
    <header className={`${className ?? ""} sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur md:px-6`}>
      {admin ? (
        <p className="font-display text-lg">Founder admin</p>
      ) : (
        <WorkspaceSwitcher />
      )}
      <div className="flex flex-1 justify-end md:justify-center">
        {(admin || !onDashboard) && <GlobalSearch scope={admin ? "admin" : "creator"} />}
      </div>
      {admin ? (
        <AccountMenu />
      ) : (
        <>
          <CreditsChip />
          <span className="md:hidden"><Notifications /></span>
          <span className="md:hidden"><AccountMenu /></span>
        </>
      )}
    </header>
  );
}
