"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { DOMAIN_ISSUES, getDomains, getOwnedStores, removeDomain, simulateDomain } from "@/lib/api";
import type { DomainIssue, DomainStatus } from "@/lib/types";
import { Section, Specimen } from "./_section";

const STATUSES: DomainStatus[] = ["not_connected", "waiting_dns", "verifying", "issuing_ssl", "connected", "needs_attention"];

/** Dev-only: drives the custom-domain simulator so every state can be checked (Part 7B). */
function DomainSimulator() {
  const stores = useApi(getOwnedStores, []);
  const [storeId, setStoreId] = useState<string>();
  const id = storeId ?? stores.data?.[0]?.id;
  const domains = useApi(() => (id ? getDomains(id) : Promise.resolve(undefined)), [id], { live: true });
  const d = domains.data?.custom;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    await fn();
    domains.reload();
    toast.success(label);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-col gap-1.5">
          <Label htmlFor="sim-store">Store</Label>
          <Select value={id} onValueChange={setStoreId}>
            <SelectTrigger id="sim-store" className="w-64 max-w-full">
              <SelectValue placeholder="Loading…" />
            </SelectTrigger>
            <SelectContent>
              {stores.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {id && (
          <Button asChild variant="secondary">
            <Link href={`/store/${id}/domain`}>Open the domain page</Link>
          </Button>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Now: {d ? <><span className="font-mono">{d.host}</span> <StatusPill status={d.status} />{d.issue && <span className="text-muted-foreground">· {DOMAIN_ISSUES[d.issue].title}</span>}</> : <span className="text-muted-foreground">no custom domain</span>}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Force a status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant="secondary" disabled={!id} onClick={() => run(`Domain set to ${s.replace(/_/g, " ")}`, () => simulateDomain(id!, { status: s, issue: s === "needs_attention" ? "wrong_target" : null }))}>
              <StatusPill status={s} />
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Force a problem</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DOMAIN_ISSUES) as DomainIssue[]).map((k) => (
            <Button key={k} size="sm" variant="secondary" disabled={!id} onClick={() => run(DOMAIN_ISSUES[k].title, () => simulateDomain(id!, { issue: k }))}>
              {DOMAIN_ISSUES[k].title}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" disabled={!id || !d} onClick={() => run("Custom domain removed", () => removeDomain(id!))}>
          Reset (remove the domain)
        </Button>
      </div>
    </div>
  );
}

export function Part7Components() {
  return (
    <Section id="domains" title="Custom domains" description="Status pills and the simulator that stands in for DNS and SSL. Force any state, then open the domain page to see it.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Specimen label="Dev: domain simulator">
          <DomainSimulator />
        </Specimen>
        <Specimen label="Status pills">
          <div className="flex flex-col items-start gap-2">
            {STATUSES.map((s) => <StatusPill key={s} status={s} />)}
          </div>
        </Specimen>
      </div>
    </Section>
  );
}
