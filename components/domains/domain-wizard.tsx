"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, ShieldCheck, Trash2, Wand2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { CopyField } from "@/components/pp/copy-field";
import { StatusPill } from "@/components/pp/status-pill";
import { StepProgress } from "@/components/pp/step-progress";
import { SaveBar } from "@/components/save/save-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import {
  addDomain,
  connectAutomatically,
  detectProvider,
  DNS_PROVIDERS,
  DOMAIN_ISSUES,
  markRecordsAdded,
  normaliseHost,
  removeDomain,
  SUBDOMAIN_ROOT,
  updateDomainSettings,
  validateHost,
  verifyDomain,
} from "@/lib/api";
import type { DomainStatus, StoreDomain, StoreDomains } from "@/lib/types";
import { cn } from "@/lib/utils";

export const RECHECK_SECONDS = 30;
const STEPS = ["Enter your domain", "Connect", "Verify"];
const TIMELINE: { status: DomainStatus; label: string }[] = [
  { status: "waiting_dns", label: "Records found" },
  { status: "verifying", label: "Domain verified" },
  { status: "issuing_ssl", label: "SSL certificate issued" },
  { status: "connected", label: "Connected" },
];
const ORDER: DomainStatus[] = ["not_connected", "waiting_dns", "verifying", "issuing_ssl", "connected"];

function stepOf(d?: StoreDomain): number {
  if (!d) return 0;
  if (d.status === "not_connected") return 1;
  return 2;
}

/** The three-step custom domain wizard (Part 7B). */
export function DomainWizard({ storeId, domains, onChange }: { storeId: string; domains: StoreDomains; onChange: (d: StoreDomains) => void }) {
  const d = domains.custom;
  const step = stepOf(d);
  return (
    <section aria-labelledby="custom-h" className="flex flex-col gap-5 rounded-card border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="custom-h" className="flex-1 font-sans text-base font-semibold tracking-normal">Custom domain</h2>
        <StatusPill status={d?.status ?? "not_connected"} />
      </div>
      {d?.status === "connected" ? (
        <ConnectedDomain storeId={storeId} domains={domains} domain={d} onChange={onChange} />
      ) : (
        <>
          <StepProgress steps={STEPS} current={step} />
          {step === 0 && <EnterStep storeId={storeId} onChange={onChange} />}
          {step === 1 && d && <ConnectStep storeId={storeId} domain={d} onChange={onChange} />}
          {step === 2 && d && <VerifyStep storeId={storeId} domain={d} onChange={onChange} />}
        </>
      )}
    </section>
  );
}

function EnterStep({ storeId, onChange }: { storeId: string; onChange: (d: StoreDomains) => void }) {
  const plan = usePlan();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const host = normaliseHost(value);
  const problem = host ? validateHost(host) : undefined;
  const provider = host && !problem ? DNS_PROVIDERS[detectProvider(host)] : undefined;

  async function next() {
    const p = validateHost(host);
    if (p) return setError(p);
    setBusy(true);
    setError(undefined);
    try {
      onChange(await addDomain(storeId, host));
    } catch (e) {
      if (!plan.handleLimitError(e)) setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dom-host">Your domain</Label>
        <Input id="dom-host" value={value} onChange={(e) => setValue(e.target.value)} placeholder="shop.yourname.in" autoCapitalize="none" spellCheck={false} inputMode="url" aria-invalid={!!error || undefined} aria-describedby="dom-host-h" />
        <p id="dom-host-h" className={cn("text-sm", error ? "font-medium text-danger" : "text-muted-foreground")} role={error ? "alert" : undefined}>
          {error ?? "A domain you already own. Use a subdomain like shop.yourname.in to keep your main site where it is."}
        </p>
      </div>
      {provider && (
        <p className="flex flex-wrap items-center gap-2 rounded-control bg-surface-sunken px-3 py-2.5 text-sm" aria-live="polite">
          Looks like it&apos;s with <span className="font-semibold">{provider.name}</span>.
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", provider.auto ? "bg-success-soft text-success" : "bg-warning-soft text-warning-ink")}>
            {provider.auto ? "Automatic setup available" : "Manual setup needed"}
          </span>
        </p>
      )}
      <Button type="submit" className="self-start" disabled={busy || !host}>
        {busy && <Loader2 className="animate-spin" aria-hidden />} Continue
      </Button>
    </form>
  );
}

function ConnectStep({ storeId, domain, onChange }: { storeId: string; domain: StoreDomain; onChange: (d: StoreDomains) => void }) {
  const provider = DNS_PROVIDERS[domain.provider];
  const [phase, setPhase] = useState<"idle" | "approving" | "working">("idle");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  // The mock stands in for the provider's own approval page, then shows the setup steps
  async function approve() {
    setPhase("working");
    for (let i = 1; i <= AUTO_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 450));
      setProgress(i);
    }
    onChange(await connectAutomatically(storeId));
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span>
          <span className="font-semibold">{domain.host}</span> is with {provider.name}.
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", domain.auto ? "bg-success-soft text-success" : "bg-warning-soft text-warning-ink")}>
          {domain.auto ? "Automatic setup available" : "Manual setup needed"}
        </span>
      </p>

      {domain.auto && (
        <div className="flex flex-col gap-3 rounded-card border border-primary/30 bg-primary-soft p-4">
          <p className="text-sm">We&apos;ll open {provider.name} so you can approve the change. It adds the records for you; nothing else on your domain changes.</p>
          {phase === "working" ? (
            <ol className="flex flex-col gap-2" aria-label="Automatic setup" aria-live="polite">
              {AUTO_STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  {i < progress ? <Check className="size-4 text-success" aria-hidden /> : i === progress ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : <span className="size-4" aria-hidden />}
                  <span className={i <= progress ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  <span className="sr-only">{i < progress ? ", done" : i === progress ? ", in progress" : ""}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Button size="lg" className="self-start" onClick={() => setPhase("approving")}>
              <Wand2 aria-hidden /> Connect automatically
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Prefer to do it yourself? The records are below.</p>
        </div>
      )}

      <RecordsTable domain={domain} />
      <HostGuide initial={domain.provider} />

      <Button
        variant={domain.auto ? "secondary" : "primary"}
        className="self-start"
        disabled={busy || phase === "working"}
        onClick={async () => {
          setBusy(true);
          try {
            onChange(await markRecordsAdded(storeId));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Loader2 className="animate-spin" aria-hidden />} I&apos;ve added the records
      </Button>

      <Dialog open={phase === "approving"} onOpenChange={(o) => !o && setPhase("idle")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <p className="eyebrow">{provider.name} · demo</p>
            <DialogTitle className="font-display text-xl">Allow PowerProof to set up {domain.host}?</DialogTitle>
            <DialogDescription>This adds {domain.records.length} DNS records so your store loads on this domain. In the real flow this page belongs to {provider.name}.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-1 rounded-control bg-surface-sunken p-3 font-mono text-xs">
            {domain.records.map((r) => (
              <li key={`${r.type}-${r.name}`} className="[overflow-wrap:anywhere]">{r.type} {r.name} → {r.value}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPhase("idle")}>Cancel</Button>
            <Button onClick={approve}>
              <ExternalLink aria-hidden /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const AUTO_STEPS = ["Approved at your DNS host", "Adding DNS records", "Records added", "Starting checks"];

export function RecordsTable({ domain }: { domain: StoreDomain }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-sans text-sm font-semibold tracking-normal">DNS records to add</h3>
      <ul className="flex flex-col gap-3" aria-label="DNS records">
        {domain.records.map((r) => (
          <li key={`${r.type}-${r.name}`} className={cn("grid grid-cols-1 gap-2 rounded-control border p-3 sm:grid-cols-[4.5rem_minmax(0,9rem)_minmax(0,1fr)] sm:items-center", r.found && "border-danger/50")}>
            <span className="font-mono text-xs font-semibold">{r.type}</span>
            <CopyField value={r.name} label={`${r.type} name`} toastText="Name copied" />
            <CopyField value={r.value} label={`${r.type} value`} toastText="Value copied" />
            {r.found && (
              <p className="text-sm text-danger sm:col-span-3">
                Right now it points to <span className="font-mono">{r.found}</span>. Change it to the value above.
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">TTL: leave the default (often 1 hour or Auto).</p>
    </div>
  );
}

function HostGuide({ initial }: { initial: keyof typeof DNS_PROVIDERS }) {
  return (
    <Tabs defaultValue={initial} className="flex flex-col gap-3">
      <h3 className="font-sans text-sm font-semibold tracking-normal">How to add them</h3>
      <TabsList className="h-auto flex-wrap justify-start">
        {Object.values(DNS_PROVIDERS).map((p) => (
          <TabsTrigger key={p.id} value={p.id} className="pointer-coarse:min-h-11">
            {p.id === "other" ? "Others" : p.id === "squarespace" ? "Squarespace (ex-Google)" : p.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {Object.values(DNS_PROVIDERS).map((p) => (
        <TabsContent key={p.id} value={p.id}>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            {p.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Seconds until the next automatic check; pauses while the tab is hidden. */
export function useCountdown(seconds: number, onZero: () => void, active: boolean) {
  const [left, setLeft] = useState(seconds);
  const cb = useRef(onZero);
  useEffect(() => {
    cb.current = onZero;
  }, [onZero]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setLeft((s) => {
        if (s <= 1) {
          cb.current();
          return seconds;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [active, seconds]);
  return { left, reset: () => setLeft(seconds) };
}

function VerifyStep({ storeId, domain, onChange }: { storeId: string; domain: StoreDomain; onChange: (d: StoreDomains) => void }) {
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try {
      const next = await verifyDomain(storeId);
      onChange(next);
      if (next.custom?.status === "connected") toast.success("Domain connected", { description: `Buyers can visit https://${next.custom.host}` });
    } finally {
      setBusy(false);
    }
  };
  const { left, reset } = useCountdown(RECHECK_SECONDS, check, !busy);
  const issue = domain.issue ? DOMAIN_ISSUES[domain.issue] : undefined;
  const at = ORDER.indexOf(domain.status === "needs_attention" ? "waiting_dns" : domain.status);

  return (
    <div className="flex flex-col gap-5">
      {issue && (
        <div role="alert" className={cn("flex flex-col gap-1.5 rounded-card border p-4", domain.status === "needs_attention" ? "border-danger/40 bg-danger-soft" : "border-warning/40 bg-warning-soft")}>
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {issue.title}
          </p>
          <p className="text-sm">{issue.reason}</p>
          <p className="flex items-start gap-2 text-sm font-medium">
            <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden /> {issue.fix}
          </p>
        </div>
      )}
      <ol className="flex flex-col gap-2" aria-label="Progress">
        {TIMELINE.map((t, i) => {
          const idx = ORDER.indexOf(t.status);
          const done = domain.status !== "needs_attention" && idx < at;
          const now = idx === at || (domain.status === "needs_attention" && i === 0);
          return (
            <li key={t.status} className="flex items-center gap-3 text-sm">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", done ? "bg-success text-primary-foreground" : now ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")} aria-hidden>
                {done ? <Check className="size-3.5" /> : now && busy ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <span className={cn(done ? "text-foreground" : "text-muted-foreground", now && "font-medium text-foreground")}>
                {t.label}
                <span className="sr-only">{done ? ", done" : now ? ", in progress" : ", waiting"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            reset();
            check();
          }}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Verify now
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="off">
          {busy ? "Checking…" : `Checking again in ${left}s`}
        </p>
      </div>
      {(domain.status === "needs_attention" || domain.status === "waiting_dns") && <RecordsTable domain={domain} />}
      <RemoveDomain storeId={storeId} host={domain.host} onChange={onChange} />
    </div>
  );
}

function ConnectedDomain({ storeId, domains, domain, onChange }: { storeId: string; domains: StoreDomains; domain: StoreDomain; onChange: (d: StoreDomains) => void }) {
  const saved = { primary: domain.primary, wwwRedirect: domain.wwwRedirect, redirectSubdomain: domain.redirectSubdomain };
  const [value, setValue] = useState(saved);
  const bar = useDirtyForm({
    value,
    saved,
    onSave: async (v) => onChange(await updateDomainSettings(storeId, v)),
    onDiscard: () => setValue(saved),
    savedMessage: "Domain settings saved",
  });
  const apex = domain.host.split(".").length === 2;
  return (
    <div className="flex flex-col gap-5">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <ShieldCheck className="size-4 text-success" aria-hidden />
        <a href={`https://${domain.host}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4">
          {domain.host} <ExternalLink className="size-3.5" aria-hidden />
        </a>
        is live with a free SSL certificate.
      </p>
      <SaveBar state={bar} bottomOffset="tabbar" className="md:ml-auto md:w-fit" />
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>
          <span className="block font-medium">Primary address</span>
          <span className="block text-muted-foreground">Links, receipts and search results use this domain.</span>
        </span>
        <Switch checked={value.primary} onCheckedChange={(primary) => setValue({ ...value, primary })} aria-label="Make this the primary address" />
      </label>
      {apex && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">www</legend>
          {(["www_to_root", "root_to_www"] as const).map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="www" className="size-4 accent-[var(--primary)]" checked={value.wwwRedirect === k} onChange={() => setValue({ ...value, wwwRedirect: k })} />
              {k === "www_to_root" ? `www.${domain.host} goes to ${domain.host}` : `${domain.host} goes to www.${domain.host}`}
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>
          <span className="block font-medium">Send {domains.subdomain}.{SUBDOMAIN_ROOT} here</span>
          <span className="block text-muted-foreground">Old links keep working and land on your domain.</span>
        </span>
        <Switch checked={value.redirectSubdomain} onCheckedChange={(redirectSubdomain) => setValue({ ...value, redirectSubdomain })} aria-label={`Redirect ${domains.subdomain}.${SUBDOMAIN_ROOT} to ${domain.host}`} />
      </label>
      <RemoveDomain storeId={storeId} host={domain.host} onChange={onChange} />
    </div>
  );
}

function RemoveDomain({ storeId, host, onChange }: { storeId: string; host: string; onChange: (d: StoreDomains) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="self-start text-danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Remove domain
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Remove ${host}?`}
        description="Buyers who visit it will stop reaching your store. Your PowerProof address keeps working. You can add the domain again later."
        confirmLabel="Remove domain"
        onConfirm={async () => {
          onChange(await removeDomain(storeId));
          setOpen(false);
          toast.success("Domain removed");
        }}
      />
    </>
  );
}
