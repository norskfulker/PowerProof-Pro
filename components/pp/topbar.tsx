"use client";

import { readableOn } from "@/lib/color";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ChevronsUpDown, Coins, ExternalLink, FolderPlus, SunMoon, ListChecks, Loader2, LogOut, Pencil, Plus, Settings, Shield, Sparkles } from "lucide-react";
import { useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { usePlan } from "@/components/plan/plan-context";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { isUnlimited, useIsAdmin } from "@/hooks/use-is-admin";
import { createOwnedStore, getOwnedStores, getWorkspaceCredits, getWorkspaces, logout, renameWorkspace, switchStore, WORKSPACE_NAME_MAX } from "@/lib/api";
import { can, roleLabel } from "@/lib/team";
import { formatNumber, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/search/global-search";
import { Notifications } from "./notifications";
import { STORE_KIND, StoreKind, StorePlace } from "./store-kind";
import { BuyCredits, CREDIT_RULE } from "@/components/agents/buy-credits";
import { CREDIT_PRICE } from "@/lib/agents/define";
import { formatMoney } from "@/lib/money";

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

/** A compact icon button with a tooltip (on hover and keyboard focus): a link, or an action */
function IconAction({ label, icon: Icon, href, onClick, onDone, size = "icon-sm" }: { label: string; icon: typeof Plus; href?: string; onClick?: () => void; onDone?: () => void; size?: "icon" | "icon-sm" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button asChild variant="ghost" size={size} aria-label={label} className="text-muted-foreground hover:text-foreground">
            <Link href={href} target="_blank" onClick={onDone}>
              <Icon aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="ghost" size={size} aria-label={label} onClick={onClick} className="text-muted-foreground hover:text-foreground">
            <Icon aria-hidden />
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Workspace › store: switch either; icons add a store, view it, and start or rename a workspace */
function WorkspaceSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const plan = usePlan();
  const unsaved = useUnsavedGuard();
  const { data: store } = useCurrentStore();
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const { data: workspaces } = useApi(getWorkspaces, [], { live: true });
  const [dialog, setDialog] = useState<StoreDialog>(null);
  const [menu, setMenu] = useState(false);
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

  // Opens a dialog from an icon in the menu: the menu closes first
  const ask = (d: StoreDialog) => {
    setMenu(false);
    plan.guard("stores", () => setDialog(d));
  };
  const canRename = !!active && can(active.access, "team");

  return (
    <>
      <DropdownMenu open={menu} onOpenChange={setMenu}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="max-w-72 min-w-0 shrink gap-2.5 px-2" aria-label={`Workspace: ${active?.name ?? "loading"}, store: ${store?.name ?? "loading"}. Switch`}>
            <span className="grid size-7 shrink-0 place-items-center rounded-[8px] font-mono text-[0.6875rem] font-semibold" style={{ background: store?.brandColor ?? "var(--primary)", color: store?.brandColor ? readableOn(store.brandColor) : "var(--primary-foreground)" }}>
              {store?.logoText ?? "··"}
            </span>
            <span className="flex min-w-0 flex-col items-start leading-tight max-sm:hidden">
              <span className="max-w-full truncate text-[0.6875rem] font-normal text-muted-foreground">{active?.name ?? "Workspace"}{store ? ` · ${STORE_KIND[store.sells].label}` : ""}</span>
              <span className="max-w-full truncate">{store?.name ?? "Loading…"}</span>
            </span>
            <ChevronsUpDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-1">
            <span className="eyebrow min-w-0 flex-1 truncate">Stores in {active?.name ?? "this workspace"}</span>
            {store && <IconAction label="View live store" href={`/s/${store.slug}`} icon={ExternalLink} onDone={() => setMenu(false)} />}
            {owner && <IconAction label={plan.state?.tier === "free" ? "Add a store (Pro)" : "Add a store"} icon={Plus} onClick={() => ask({ kind: "store" })} />}
          </DropdownMenuLabel>
          {here.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => !s.active && open(s.id, s.name)} className="items-start">
              {s.active ? <Check className="mt-0.5" aria-hidden /> : <span className="size-4" aria-hidden />}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate">{s.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[0.6875rem]">
                  <StoreKind sells={s.sells} compact />
                  <StorePlace country={s.country} />
                </span>
              </span>
              <span className="font-mono text-[0.625rem] text-muted-foreground" title={`${s.products} in all`}>{s.liveProducts} live</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1">
            <span className="eyebrow min-w-0 flex-1 truncate">Workspaces</span>
            {canRename && <IconAction label="Rename workspace" icon={Pencil} onClick={() => { setMenu(false); setDialog({ kind: "rename", name: active!.name }); }} />}
            <IconAction label="New workspace" icon={FolderPlus} onClick={() => ask({ kind: "workspace" })} />
          </DropdownMenuLabel>
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
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The most used store action, one tap from the bar */}
      {store && (
        <span className="max-sm:hidden">
          <IconAction label="View live store" href={`/s/${store.slug}`} icon={ExternalLink} size="icon" />
        </span>
      )}
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
  const { data, reload } = useApi(getWorkspaceCredits, [store?.workspaceId], { live: true });
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (data === undefined) return null;
  const unlimited = isUnlimited(data);
  const label = unlimited ? "Unlimited credits" : `${formatNumber(data)} ${data === 1 ? "credit" : "credits"}`;
  const canBuy = can(store?.access, "agents");
  // Opens on hover with a short grace period, so the pointer can travel into the card
  const hover = (o: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(o), o ? 80 : 160);
  };
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="font-mono" aria-label={`Agent credits: ${label}`} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
            <Coins aria-hidden className={cn(data <= 0 && "text-warning-ink")} />
            <span className="max-sm:sr-only">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72" onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
          <p className="text-sm text-muted-foreground">Balance available</p>
          <p className="font-display text-3xl font-bold tracking-[-0.03em] tabular">{unlimited ? "Unlimited" : formatNumber(data)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {unlimited
              ? "PowerProof staff workspaces never run out. Every run is still recorded."
              : <>Shared by every store and agent in {store?.workspaceName ?? "this workspace"}. {CREDIT_RULE} At zero, agents pause.</>}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {unlimited ? null : canBuy ? (
              <Button
                onClick={() => {
                  setOpen(false);
                  setBuying(true);
                }}
              >
                <Plus aria-hidden /> Buy credits
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Ask the workspace owner to buy credits.</p>
            )}
            {!unlimited && <p className="text-center text-xs text-muted-foreground">Any amount, {formatMoney({ amount: CREDIT_PRICE.perCreditMinor, currency: CREDIT_PRICE.currency })} a credit.</p>}
            {canBuy && (
              <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                <Link href="/marketplace?tab=subscribed">Subscribed agents and usage</Link>
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {canBuy && !unlimited && <BuyCredits open={buying} onOpenChange={setBuying} workspaceName={store?.workspaceName} onBought={reload} />}
    </>
  );
}

/** Profile, settings, colour mode and log out. `row` is the sidebar's own line with the name and email. */
export function AccountMenu({ variant = "avatar" }: { variant?: "avatar" | "row" }) {
  const router = useRouter();
  const gs = useGettingStarted();
  const { data: store } = useCurrentStore();
  const { state: planState, upgrade } = usePlan();
  const isAdmin = useIsAdmin();
  // Staff are always on Pro, with unlimited agent credits (migration 064); everyone else, their real plan
  const pro = isAdmin || planState?.tier === "pro";
  const planLabel = isAdmin ? "Unlimited Pro" : pro ? "Pro" : "Free";

  const avatar = (
    <Avatar className={variant === "row" ? "size-8" : "size-9"}>
      <AvatarFallback className="bg-accent-soft font-semibold text-accent-ink">{initials(store?.ownerName ?? "")}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "row" ? (
          <Button variant="ghost" size="lg" className="w-full justify-start gap-2.5 px-2" aria-label={`Account menu, ${planLabel} plan`}>
            {avatar}
            <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <span className="max-w-full truncate text-sm font-semibold">{store?.ownerName}</span>
              {!pro && planState && !planState.joined && <span className="text-xs font-medium text-accent-ink">Pro available</span>}
            </span>
            {(planState || isAdmin) && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", pro ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{isAdmin ? "Unlimited" : planLabel}</span>}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Account menu">{avatar}</Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={variant === "row" ? "right" : "bottom"} sideOffset={variant === "row" ? 12 : 4} className="w-64">
        <DropdownMenuLabel>
          <span className="block">{store?.ownerName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{store?.ownerEmail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* One plan entry, saying what the person really has */}
        {planState?.joined && !isAdmin ? (
          <div className="flex items-center gap-2 px-2 py-2 text-sm">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">Workspace owner&apos;s plan</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold">{planState.tier === "pro" ? "Pro" : "Free"}</span>
          </div>
        ) : pro ? (
          <DropdownMenuItem asChild className="my-1 rounded-control bg-accent-soft py-2.5 focus:bg-accent-soft/80">
            <Link href="/settings/billing">
              <Sparkles className="text-accent-ink" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-accent-ink">{planLabel} plan</span>
                <span className="text-xs text-muted-foreground">{isAdmin ? "Staff: every Pro feature and unlimited agent credits" : "Billing and plan"}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => upgrade()} className="my-1 rounded-control bg-accent-soft py-2.5 focus:bg-accent-soft/80">
            <Sparkles className="text-accent-ink" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-accent-ink">Free plan</span>
              <span className="text-xs text-muted-foreground">Upgrade to Pro</span>
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
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
            <Shield aria-hidden /> Switch to admin view
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
 * they stay here too). The search box is the only one in the app: every page shares it.
 */
export function Topbar({ admin, className }: { admin?: boolean; className?: string }) {
  return (
    <header className={`${className ?? ""} sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur md:px-6`}>
      {admin ? (
        <p className="font-display text-lg">Founder admin</p>
      ) : (
        <WorkspaceSwitcher />
      )}
      <div className="flex flex-1 justify-end md:justify-center">
        <GlobalSearch scope={admin ? "admin" : "creator"} />
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
