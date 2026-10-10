"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { useCurrentStore } from "@/hooks/use-current-store";
import { can, needForPath, roleLabel, TEAM_AREAS, type StoreAccess, type TeamArea } from "@/lib/team";

/** Where each area starts, for the team member's home */
const AREA_HOME: Record<TeamArea, string> = {
  catalog: "/catalog/products",
  orders: "/sales/orders",
  design: "/store/current/design/pages/home/edit",
  marketing: "/store/current/offers/coupons",
  analytics: "/dashboard",
  business: "/settings/company",
};

/** A team member's start page when the dashboard's figures aren't theirs to see */
function TeamHome({ storeName, access }: { storeName: string; access: StoreAccess }) {
  const areas = TEAM_AREAS.filter((a) => can(access, a.id) && a.id !== "analytics");
  return (
    <>
      <PageHeader title={storeName} description={`You're on this store's team (${roleLabel(access.role)}). Here's what you can work on.`} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <li key={a.id}>
            <Link href={AREA_HOME[a.id]} className="flex h-full flex-col gap-1 rounded-card border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary-soft/40">
              <span className="flex items-center justify-between gap-2 font-semibold">{a.label} <ArrowRight className="size-4 text-muted-foreground" aria-hidden /></span>
              <span className="text-sm text-muted-foreground">{a.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Creator pages a team member can't use say so, instead of loading empty data. The database
 * refuses those reads and writes anyway (store_can in every policy); this is the plain answer.
 */
export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: store } = useCurrentStore();
  const access = store?.access;
  if (!access || access.role === "owner") return <>{children}</>;
  if (pathname === "/dashboard" && !can(access, "analytics")) return <TeamHome storeName={store.name} access={access} />;
  const need = needForPath(pathname);
  if (can(access, need)) return <>{children}</>;
  return (
    <EmptyState
      icon={Lock}
      title={need === "owner" ? "Only the store's owner can open this." : "This part of the store isn't in your access."}
      body={need === "owner" ? "Payouts, billing and the plan stay with the owner." : `Ask the owner of ${store.name} to add it to your access in Settings › Team.`}
      action={<Button asChild variant="secondary"><Link href="/dashboard">Go to your start page</Link></Button>}
    />
  );
}
