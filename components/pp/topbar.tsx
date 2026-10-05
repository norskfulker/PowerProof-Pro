"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, ExternalLink, FlaskConical, LogOut, Plus, Settings, Shield } from "lucide-react";
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
import { getDemoState, getStore, loadSampleData, loadStressData, logout, setDemoState, startEmptyStore } from "@/lib/api";
import { initials } from "@/lib/format";
import { GlobalSearch } from "@/components/search/global-search";
import { Notifications } from "./notifications";

function StoreSwitcher() {
  const { data: store } = useApi(getStore, [], { live: true });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-56 min-w-0 shrink gap-2.5 px-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-primary font-mono text-[0.6875rem] font-semibold text-primary-foreground">
            {store?.logoText ?? "··"}
          </span>
          <span className="truncate max-sm:hidden">{store?.name ?? "Loading…"}</span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="eyebrow">Your stores</DropdownMenuLabel>
        <DropdownMenuItem>
          <Check aria-hidden /> {store?.name}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Plus aria-hidden /> Add another store <span className="ml-auto font-mono text-[0.625rem]">SOON</span>
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
  );
}

function AccountMenu() {
  const router = useRouter();
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
