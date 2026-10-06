"use client";

import { Check, EyeOff, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getReviewsForModeration, moderateReview } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function AdminReviewModerationPage() {
  const { data, error, reload, setData } = useApi(getReviewsForModeration, []);
  const act = async (storeId: string, id: string, action: "hide" | "keep") => {
    await moderateReview(storeId, id, action);
    setData((data ?? []).filter((r) => r.id !== id));
    toast.success(action === "hide" ? "Review hidden" : "Review kept", { description: "The report is closed." });
  };
  return (
    <>
      <PageHeader title="Reported reviews" description="Reviews someone reported. Hide anything abusive, fake or off-topic; keep honest criticism." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64 rounded-card" />
      ) : data.length === 0 ? (
        <EmptyState icon={Star} title="Nothing to review." body="Reported reviews show up here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-card border bg-surface p-4 md:flex-row md:items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  {r.storeName} · {r.productTitle} · {formatDate(r.createdAt)}
                </p>
                <p className="mt-1 font-semibold">
                  <span role="img" aria-label={`${r.rating} out of 5 stars`}>
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>{" "}
                  {r.title}
                </p>
                <p className="mt-1 text-sm">{r.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">by {r.author}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => act(r.storeId, r.id, "keep")}>
                  <Check aria-hidden /> Keep
                </Button>
                <Button variant="danger" size="sm" onClick={() => act(r.storeId, r.id, "hide")}>
                  <EyeOff aria-hidden /> Hide
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
