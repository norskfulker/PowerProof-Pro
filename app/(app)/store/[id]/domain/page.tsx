"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { usePlan } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/hooks/use-current-store";
import { DNS_PROVIDERS, DOMAIN_ISSUES, detectProvider, normaliseHost, validateHost } from "@/lib/api";
import type { DomainIssue } from "@/lib/types";

interface Domain {
  host: string;
  status: "pending" | "verifying" | "active" | "failed";
  records: { type: string; name: string; value: string }[];
  issue: string | null;
  checkedAt: string | null;
}
type Load = { state: "loading" } | { state: "ready"; domain: Domain | null; connected: boolean } | { state: "blocked"; code: number; message: string };

async function api(method: "GET" | "POST" | "DELETE", path: string, storeId: string, host?: string): Promise<{ ok: boolean; status: number; body: { message?: string; domain?: Domain | null; connected?: boolean } }> {
  const res = await fetch(method === "GET" ? `${path}?storeId=${storeId}` : path, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify({ storeId, host }), cache: "no-store" });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

function Copyable({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 font-mono text-[0.8125rem] hover:bg-muted pointer-coarse:min-h-11"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the text instead.");
        }
      }}
    >
      <span className="break-all text-left">{text}</span>
      {done ? <Check className="size-3.5 shrink-0 text-success" aria-hidden /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
    </button>
  );
}

/** Store › Domain: connect a domain you own. Pro plan. The records to add, a live check, and what to do if something's off. */
export default function StoreDomainPage() {
  const store = useCurrentStore();
  const plan = usePlan();
  const storeId = store.data?.id;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [host, setHost] = useState("");
  const [hostError, setHostError] = useState<string>();
  const [busy, setBusy] = useState<"add" | "check" | "remove">();
  const [confirm, setConfirm] = useState(false);

  const read = useCallback(async () => {
    if (!storeId) return;
    const r = await api("GET", "/api/domains", storeId).catch(() => undefined);
    if (!r) return setLoad({ state: "blocked", code: 0, message: "We couldn't reach the server. Check your connection." });
    setLoad(r.ok ? { state: "ready", domain: r.body.domain ?? null, connected: !!r.body.connected } : { state: "blocked", code: r.status, message: r.body.message ?? "Something went wrong." });
  }, [storeId]);

  useEffect(() => {
    const t = setTimeout(() => void read(), 0);
    return () => clearTimeout(t);
  }, [read]);

  // While it waits for DNS, look again every 30 seconds
  const pending = load.state === "ready" && load.domain && load.domain.status !== "active";
  useEffect(() => {
    if (!pending || !storeId) return;
    const t = setInterval(async () => {
      const r = await api("POST", "/api/domains/verify", storeId).catch(() => undefined);
      if (r?.ok && r.body.domain) setLoad({ state: "ready", domain: r.body.domain, connected: true });
    }, 30_000);
    return () => clearInterval(t);
  }, [pending, storeId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    const h = normaliseHost(host);
    const bad = validateHost(h);
    if (bad) return setHostError(bad);
    setHostError(undefined);
    setBusy("add");
    const r = await api("POST", "/api/domains", storeId, h).catch(() => undefined);
    setBusy(undefined);
    if (r?.ok && r.body.domain) {
      setLoad({ state: "ready", domain: r.body.domain, connected: true });
      toast.success("Domain added", { description: "Now add the records below at your DNS provider." });
    } else setHostError(r?.body.message ?? "We couldn't reach the server. Try again.");
  }

  async function check() {
    if (!storeId) return;
    setBusy("check");
    const r = await api("POST", "/api/domains/verify", storeId).catch(() => undefined);
    setBusy(undefined);
    if (r?.ok && r.body.domain) {
      setLoad({ state: "ready", domain: r.body.domain, connected: true });
      if (r.body.domain.status === "active") toast.success("Your domain is live", { description: `Buyers can now visit ${r.body.domain.host}.` });
    } else toast.error("Couldn't check", { description: r?.body.message });
  }

  const header = <PageHeader title="Domain" description="Use your own web address for this store, like shop.yourname.in." />;
  if (load.state === "loading" || !storeId) return <>{header}<Skeleton className="h-64 rounded-card" /></>;

  if (load.state === "blocked") {
    return (
      <>
        <title>Domain · PowerProof</title>
        {header}
        {load.code === 402 ? (
          <EmptyState icon={Globe} title="Your own domain is part of Pro." body="Your store already has its free address. Upgrade to Pro to use a domain you own, with a free SSL certificate." action={<Button onClick={() => plan.upgrade("customDomain")}>See Pro</Button>} />
        ) : load.code === 503 ? (
          <EmptyState icon={Globe} title="Custom domains aren't switched on here yet." body="Your store works at its free address. Connecting your own domain needs the hosting connection (VERCEL_API_TOKEN and VERCEL_PROJECT_ID) to be set for this site." />
        ) : (
          <EmptyState icon={Globe} title="We couldn't load your domain." body={load.message} action={<Button variant="secondary" onClick={() => void read()}>Try again</Button>} />
        )}
      </>
    );
  }

  const d = load.domain;
  const provider = d ? DNS_PROVIDERS[detectProvider(d.host)] : undefined;
  const issue = d?.issue ? DOMAIN_ISSUES[d.issue as DomainIssue] : undefined;
  return (
    <>
      <title>Domain · PowerProof</title>
      {header}
      {!d ? (
        <form noValidate onSubmit={add} className="flex max-w-xl flex-col gap-3 rounded-card border bg-surface p-5 md:p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Connect a domain you own</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dom">Your domain</Label>
            <Input id="dom" placeholder="shop.yourname.in" autoComplete="off" spellCheck={false} inputMode="url" aria-invalid={!!hostError || undefined} aria-describedby="dom-note" value={host} onChange={(e) => { setHost(e.target.value); setHostError(undefined); }} />
            <p id="dom-note" className={hostError ? "text-sm font-medium text-danger" : "text-sm text-muted-foreground"}>{hostError ?? "A subdomain (shop.yourname.in) is easiest. A bare domain (yourname.in) works too."}</p>
          </div>
          <Button type="submit" disabled={busy === "add"} className="w-fit">{busy === "add" && <Loader2 className="animate-spin" aria-hidden />} Connect domain</Button>
        </form>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="dom-h" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="dom-h" className="flex items-center gap-2 font-mono text-lg">{d.host}</h2>
                <p className={d.status === "active" ? "mt-1 flex items-center gap-1.5 text-sm font-medium text-success" : "mt-1 text-sm text-muted-foreground"}>
                  {d.status === "active" ? <><Check className="size-4" aria-hidden /> Live. Buyers can visit this address, with a free SSL certificate.</> : "Waiting for your DNS records. We check every 30 seconds."}
                </p>
              </div>
              <div className="flex gap-2">
                {d.status !== "active" && (
                  <Button variant="secondary" onClick={check} disabled={busy !== undefined}>
                    {busy === "check" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Verify now
                  </Button>
                )}
                <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)} disabled={busy !== undefined}><Trash2 aria-hidden /> Remove</Button>
              </div>
            </div>
            {issue && d.status !== "active" && (
              <div role="status" className="rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
                <p className="font-semibold">{issue.title}</p>
                <p className="mt-1">{issue.reason}</p>
                <p className="mt-1 text-muted-foreground">{issue.fix}</p>
              </div>
            )}
          </section>

          {d.status !== "active" && (
            <section aria-labelledby="rec-h" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
              <h2 id="rec-h" className="font-sans text-base font-semibold tracking-normal">Add {d.records.length === 1 ? "this record" : "these records"} at {provider?.name ?? "your DNS provider"}</h2>
              <div className="overflow-x-auto rounded-control border">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="bg-surface-sunken text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Value</th></tr></thead>
                  <tbody className="divide-y">
                    {d.records.map((r, i) => (
                      <tr key={i}><td className="px-3 py-2 font-mono text-[0.8125rem]">{r.type}</td><td className="px-3 py-2"><Copyable text={r.name} label={`${r.type} name`} /></td><td className="px-3 py-2"><Copyable text={r.value} label={`${r.type} value`} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {provider && (
                <ol className="list-decimal pl-5 text-sm text-muted-foreground">
                  {provider.steps.map((s) => <li key={s} className="py-0.5">{s}</li>)}
                </ol>
              )}
              <p className="text-xs text-muted-foreground">DNS changes can take a few minutes, sometimes up to a day. You can leave this page; the domain goes live by itself once the records are found.</p>
            </section>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${d?.host ?? "this domain"}?`}
        description="Buyers who use this address will no longer reach your store. Your free address keeps working."
        confirmLabel="Remove domain"
        onConfirm={async () => {
          if (!storeId) return;
          setBusy("remove");
          const r = await api("DELETE", "/api/domains", storeId).catch(() => undefined);
          setBusy(undefined);
          if (r?.ok) {
            setLoad({ state: "ready", domain: null, connected: true });
            setHost("");
            toast.success("Domain removed");
          } else {
            toast.error("Couldn't remove it", { description: r?.body.message });
            throw new Error("remove failed");
          }
        }}
      />
    </>
  );
}
