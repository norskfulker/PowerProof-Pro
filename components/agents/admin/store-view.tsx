"use client";

import { useState } from "react";
import { getManifest } from "@/agents/index";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { adminGet, adminOp } from "@/lib/api/agents";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type Row = Record<string, unknown>;
type StoreView = { store: { id: string; name: string } | null; instances: Row[]; runs: Row[]; outbox: Row[]; actions: Row[]; credits: number };

/** Read-only view of one store's agents for support (contacts masked; each view is audited) */
export function AdminStoreView({ storeId }: { storeId: string }) {
  const { data, loading, error, reload } = useApi(() => adminGet<StoreView>("store", { storeId }), [storeId]);
  const [credits, setCredits] = useState("");
  const [reason, setReason] = useState("");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96 rounded-card" />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={data.store?.name ?? "Store"} back={{ href: "/admin/agents?tab=stores", label: "Agents" }} />
      <p className="rounded-control border bg-info-soft p-3 text-sm">Read-only. This view was written to the audit log.</p>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Agents · {data.credits} credits left</h2>
        <ul className="flex flex-col divide-y rounded-card border bg-surface">
          {data.instances.map((i) => (
            <li key={String(i.id)} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-semibold">{getManifest(String(i.agent_id))?.name ?? String(i.agent_id)}</span>
              <StatusPill status={String(i.status)} />
              <Button size="sm" variant="secondary" onClick={() => adminOp({ op: "instance_status", instanceId: i.id, suspend: i.status !== "suspended" }).then(() => (toast.success("Saved."), reload()), (e) => toast.error(String(e.message)))}>
                {i.status === "suspended" ? "Lift suspension" : "Suspend"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2 rounded-card border bg-surface p-4">
        <h2 className="text-base font-semibold">Give or take credits</h2>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Credits (negative to take)" inputMode="numeric" className="max-w-32" placeholder="25" value={credits} onChange={(e) => setCredits(e.target.value)} />
          <Input aria-label="Reason" className="max-w-sm" placeholder="Why (goes in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button disabled={!Number(credits) || reason.trim().length < 3} onClick={() => adminOp({ op: "grant_credits", storeId, credits: Number(credits), reason }).then(() => (toast.success("Done."), setCredits(""), setReason(""), reload()), (e) => toast.error(String(e.message)))}>
            Save
          </Button>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Recent runs</h2>
        <ul className="flex flex-col divide-y rounded-card border bg-surface text-sm">
          {data.runs.map((r) => (
            <li key={String(r.id)} className="px-4 py-2.5">
              {String(r.trigger)} · {String(r.status)} · {formatDate(String(r.started_at), { time: true })} {r.error ? <span className="text-danger">· {String(r.error)}</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Recent messages</h2>
        <ul className="flex flex-col divide-y rounded-card border bg-surface text-sm">
          {data.outbox.map((o) => (
            <li key={String(o.id)} className="px-4 py-2.5">
              {String(o.channel)} to {String(o.to_address)} · {String(o.status)} · {formatDate(String(o.created_at), { time: true })} {o.error ? <span className="text-danger">· {String(o.error)}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
