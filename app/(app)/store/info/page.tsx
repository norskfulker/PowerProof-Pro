"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getStore } from "@/lib/api";

/** Old address: About, FAQ and policies now live per store under /store/[id]/pages. */
export default function StoreInfoRedirect() {
  const router = useRouter();
  useEffect(() => {
    getStore().then((s) => router.replace(`/store/${s.id}/pages/about`));
  }, [router]);
  return <Skeleton className="h-96 rounded-card" aria-busy />;
}
