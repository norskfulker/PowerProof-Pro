import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { BuyerShell } from "./buyer-shell";

/** Shared loading / not found / error frames for buyer pages. */
export function BuyerStatus({ error, onRetry, kind = "page" }: { error?: string; onRetry: () => void; kind?: "page" | "store" | "order" }) {
  if (error && error.includes("not found")) {
    const what = kind === "store" ? "store" : kind === "order" ? "order" : "page";
    return (
      <BuyerShell narrow>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground"><SearchX className="size-6" aria-hidden /></span>
          <h1 className="text-[1.75rem]">We can&apos;t find that {what}.</h1>
          <p className="max-w-sm text-muted-foreground">
            {kind === "order" ? "Check the link in your receipt email, or look up your order by email." : "The link may have a typo, or the creator has taken it down."}
          </p>
          <Button asChild variant="secondary" className="mt-2"><Link href="/lookup">Find my order</Link></Button>
        </div>
      </BuyerShell>
    );
  }
  if (error) {
    return (
      <BuyerShell narrow>
        <ErrorState message={error} onRetry={onRetry} />
      </BuyerShell>
    );
  }
  return (
    <BuyerShell narrow>
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="aspect-[4/3] w-full rounded-card" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-12 w-full" />
      </div>
    </BuyerShell>
  );
}
