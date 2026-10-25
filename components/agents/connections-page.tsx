"use client";

import { useState } from "react";
import { FileSpreadsheet, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getManifest } from "@/agents/index";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { agentOp, connectionOp, getConnections, getMyAgents, type AgentConnection } from "@/lib/api/agents";
import { timeAgo } from "@/lib/format";
import { GoogleSheetButton } from "./google-sheet";

const HEALTH: Record<AgentConnection["status"], [string, "success" | "warning" | "danger"]> = {
  connected: ["Connected", "success"],
  needs_reauth: ["Connect again", "warning"],
  error: ["Not working", "danger"],
};

/** The store's connections, shared by every agent: health, test, use with another agent, remove */
export function ConnectionsPage() {
  const { data, loading, error, reload } = useApi(getConnections, [], { live: true });
  const agents = useApi(getMyAgents, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AgentConnection | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const test = async (c: AgentConnection) => {
    setBusy(c.id);
    try {
      const r = await connectionOp<{ status: string; problem: string | null }>({ op: "test", connectionId: c.id });
      if (r.status === "connected") toast.success("Working. Read it just now.");
      else toast.error(r.problem ?? "It isn't working.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The test didn't run.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Connections" back={{ href: "/marketplace?tab=subscribed", label: "Subscribed agents" }} />
      <p className="max-w-2xl text-muted-foreground">Connect something once and every agent that needs it can use it. Passwords and keys stay on PowerProof&apos;s server and are never shown again.</p>
      {loading || !data ? (
        <Skeleton className="h-40 rounded-card" />
      ) : data.length ? (
        <ul className="flex flex-col gap-3">
          {data.map((c) => {
            const [label, tone] = HEALTH[c.status];
            const users = (agents.data ?? []).filter((a) => c.usedBy.includes(a.id));
            const others = (agents.data ?? []).filter((a) => !c.usedBy.includes(a.id) && getManifest(a.agentId)?.connectors.some((x) => x.type === c.type));
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-card border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.label || (c.type === "google_sheets" ? "Google Sheet" : c.type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {users.length ? `Used by ${users.map((u) => getManifest(u.agentId)?.name).join(", ")}` : "Not used by an agent yet"}
                      {c.lastCheckedAt ? ` · checked ${timeAgo(c.lastCheckedAt)}` : ""}
                    </p>
                    {c.lastError && c.status !== "connected" && <p className="mt-1 text-sm text-danger">{c.lastError}</p>}
                  </div>
                  <StatusPill status={c.status} label={label} tone={tone} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status === "connected" ? (
                    <Button size="sm" variant="secondary" disabled={busy === c.id} onClick={() => test(c)}>
                      {busy === c.id ? "Testing…" : "Test connection"}
                    </Button>
                  ) : c.type === "google_sheets" ? (
                    <GoogleSheetButton label="Connect the sheet again" onDone={() => toast.success("Connected. Paused agents are back on.")} />
                  ) : null}
                  {others.map((a) => (
                    <Button
                      key={a.id}
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await agentOp(a.id, { op: "link", connectorKey: getManifest(a.agentId)!.connectors.find((x) => x.type === c.type)!.key, connectionId: c.id });
                          toast.success(`${getManifest(a.agentId)?.name} now uses it.`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "That didn't save.");
                        }
                      }}
                    >
                      Use with {getManifest(a.agentId)?.name}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(c)}>
                    <Trash2 aria-hidden /> Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Plug} title="Nothing connected yet" body="Agents ask for what they need while you set them up. You can connect a Google Sheet here too." action={<GoogleSheetButton onDone={() => toast.success("Connected.")} />} />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this connection?"
        description="PowerProof forgets its access. Agents that used it stop reading it; data they already have is kept."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await connectionOp({ op: "remove", connectionId: removing.id });
            toast.success("Removed.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't work.");
          }
        }}
      />
    </div>
  );
}
