"use client";

import { useState } from "react";
import { Flag as FlagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/pp/segmented";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getFlags, setFlagStatus } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Flag } from "@/lib/types";

export default function AdminFlagsPage() {
  const { data, loading, error, reload, setData } = useApi(getFlags, []);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [remove, setRemove] = useState<Flag | null>(null);
  const apply = (f: Flag) => setData((data ?? []).map((x) => (x.id === f.id ? f : x)));
  const list = data?.filter((f) => (tab === "open" ? f.status === "open" : f.status !== "open"));

  return (
    <>
      <PageHeader
        title="Flagged content"
        description="Reports from buyers, rights holders and automatic checks. Remove what breaks the rules; dismiss the rest."
        actions={
          <Segmented label="Flag status" value={tab} onChange={setTab} options={[{ value: "open", label: `Open${data ? ` (${data.filter((f) => f.status === "open").length})` : ""}` }, { value: "closed", label: "Closed" }]} />
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
      ) : list?.length === 0 ? (
        <EmptyState icon={FlagIcon} title={tab === "open" ? "Nothing flagged." : "Nothing closed yet."} body={tab === "open" ? "The platform is behaving itself." : undefined} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list?.map((f) => (
            <li key={f.id} className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow">{f.kind}</span>
                  <StatusPill status={f.status} />
                </div>
                <p className="mt-1 font-semibold">{f.target}</p>
                <p className="text-sm text-muted-foreground">{f.storeName} · {f.reason} · reported by {f.reporter}, {timeAgo(f.createdAt)}</p>
              </div>
              {f.status === "open" && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={async () => { apply(await setFlagStatus(f.id, "dismissed")); toast.success("Dismissed"); }}>Dismiss</Button>
                  <Button variant="danger" onClick={() => setRemove(f)}>Remove {f.kind}</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => !o && setRemove(null)}
        title={`Remove “${remove?.target}”?`}
        description="It goes offline now and the creator gets an email with the reason. Past buyers keep access unless you refund them."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!remove) return;
          apply(await setFlagStatus(remove.id, "removed"));
          toast.success("Removed", { description: remove.target });
        }}
      />
    </>
  );
}
