"use client";

import Link from "next/link";
import { AGENT_UI } from "@/agents/ui";
import { getManifest } from "@/agents/index";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getInstance } from "@/lib/api/agents";
import { cn } from "@/lib/utils";

/** Renders an agent's own screen by name, with its section links on top */
export function AgentView({ instanceId, path }: { instanceId: string; path: string[] }) {
  const { data: instance, loading, error, reload } = useApi(() => getInstance(instanceId), [instanceId], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !instance) return <Skeleton className="h-96 rounded-card" />;
  const m = getManifest(instance.agentId);
  const ui = AGENT_UI[instance.agentId];
  const View = ui?.views?.[path[0]];
  if (!m || !View)
    return (
      <EmptyState
        title="That page isn't here."
        action={
          <Button asChild variant="secondary">
            <Link href={`/agents/my/${instanceId}`}>Back</Link>
          </Button>
        }
      />
    );
  const current = ui.links?.find((l) => l.view === path[0]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={current?.label ?? m.name} back={{ href: `/agents/my/${instanceId}`, label: m.name }} />
      {ui.links && (
        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4" aria-label={`${m.name} sections`}>
          {ui.links.map((l) => (
            <Link key={l.view} href={`/agents/my/${instanceId}/${l.view}`} aria-current={l.view === path[0] ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold", l.view === path[0] ? "border-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
      <View instance={instance} path={path} />
    </div>
  );
}
