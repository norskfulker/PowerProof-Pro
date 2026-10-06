"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { useNavTrail } from "./use-nav";

function BackLink({ back }: { back: { href: string; label: string } }) {
  return (
    <Link href={back.href} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-muted-foreground hover:text-foreground pointer-fine:min-h-8">
      <ArrowLeft className="size-4" aria-hidden />
      {back.label}
    </Link>
  );
}

function Crumbs({ current, back }: { current?: string; back?: { href: string; label: string } }) {
  const pathname = usePathname();
  const area = pathname.startsWith("/admin") ? "admin" : "creator";
  const trail = useNavTrail(area);
  if (!trail.length) return back ? <BackLink back={back} /> : null;
  return <Breadcrumbs area={area} current={current} />;
}

/** Breadcrumbs from the nav tree when the page is in the menu; the old back link otherwise. */
export function PageCrumbs({ current, back }: { current?: string; back?: { href: string; label: string } }) {
  return (
    <Suspense fallback={back ? <BackLink back={back} /> : null}>
      <Crumbs current={current} back={back} />
    </Suspense>
  );
}
