"use client";

import { useRef, useState } from "react";
import { Bot, CreditCard, Download, Loader2, Lock, PlugZap, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CopyField } from "@/components/pp/copy-field";
import { Segmented } from "@/components/pp/segmented";
import { usePlan } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldLabel, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { AI_PROVIDERS, integrationFileSchema, PAYMENT_PROVIDERS, type AiProvider, type FieldSpec, type IntegrationKind, type IntegrationView, type PaymentProvider } from "@/lib/integrations";
import { cn } from "@/lib/utils";

type Listing = { ok: true; pro: boolean; items: IntegrationView[]; webhooks: { custom: string; stripe: string } };

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!res.ok || json.ok === false) throw new Error(json.message ?? "Something went wrong. Try again.");
  return json;
}

function Field({ spec, value, saved, onChange }: { spec: FieldSpec; value: string; saved?: boolean; onChange: (v: string) => void }) {
  const id = `f-${spec.key}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {spec.label}
        {spec.optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      <Input id={id} type={spec.secret ? "password" : "text"} autoComplete="off" spellCheck={false} className={spec.secret || spec.key.toLowerCase().includes("key") ? "font-mono" : undefined} value={value} placeholder={spec.secret && saved ? "Saved. Type a new one to replace it" : spec.placeholder} onChange={(e) => onChange(e.target.value)} />
      {spec.hint && <p className="text-xs text-muted-foreground">{spec.hint}</p>}
    </div>
  );
}

/** Save, test and remove, shared by both cards */
function Actions({ busy, saved, onSave, onTest, onRemove, disabled }: { busy?: string; saved: boolean; onSave: () => void; onTest: () => void; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
      <Button type="button" onClick={onSave} disabled={!!busy || disabled}>{busy === "save" && <Loader2 className="animate-spin" aria-hidden />}Save</Button>
      <Button type="button" variant="secondary" onClick={onTest} disabled={!!busy || !saved || disabled}>{busy === "test" ? <Loader2 className="animate-spin" aria-hidden /> : <PlugZap aria-hidden />}Test connection</Button>
      {saved && <Button type="button" variant="ghost" className="ml-auto text-danger" onClick={onRemove} disabled={!!busy || disabled}><Trash2 aria-hidden /> Remove</Button>}
    </div>
  );
}

/**
 * A store's own payment gateway and AI provider (Pro). Secrets are typed in once, encrypted on the
 * server and never shown again. Settings can be saved to a JSON file and loaded back.
 */
export function Connections() {
  const store = useCurrentStore().data;
  const storeId = store?.id;
  const list = useApi(() => (storeId ? call<Listing>("GET", `/api/integrations?storeId=${storeId}`) : Promise.resolve(undefined)), [storeId]);
  const { upgrade } = usePlan();
  const data = list.data;
  const pro = !!data?.pro;
  const item = (k: IntegrationKind) => data?.items.find((i) => i.kind === k);

  if (!storeId || !data) return list.error ? <p className="text-sm text-danger">{list.error}</p> : null;

  return (
    <section aria-labelledby="conn-h" className="mt-10 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="conn-h" className="flex items-center gap-2 font-display text-xl">Your own connections {!pro && <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-sans text-xs font-semibold text-primary"><Lock className="size-3" aria-hidden /> Pro</span>}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Bring your own payment gateway and your own AI. Keys are encrypted the moment they reach us and never shown again.</p>
        </div>
        {!pro && <Button type="button" onClick={() => upgrade()}>Upgrade to Pro</Button>}
      </div>
      <div className={cn("grid grid-cols-1 gap-6 xl:grid-cols-2", !pro && "pointer-events-none opacity-60")} inert={!pro || undefined}>
        <PaymentCard storeId={storeId} saved={item("payment")} webhooks={data.webhooks} onChange={list.reload} />
        <AiCard storeId={storeId} saved={item("ai")} onChange={list.reload} />
      </div>
    </section>
  );
}

function useRunner(storeId: string, kind: IntegrationKind, onChange: () => void) {
  const [busy, setBusy] = useState<string>();
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(undefined);
    }
  };
  return {
    busy,
    save: (provider: string, config: Record<string, unknown>, secrets: Record<string, string>, enabled: boolean, after?: () => void) =>
      run("save", async () => {
        const r = await call<{ warning?: string }>("PUT", "/api/integrations", { storeId, kind, provider, config, secrets, enabled });
        if (r.warning) toast.warning(r.warning);
        else toast.success("Saved");
        after?.();
        onChange();
      }),
    test: () =>
      run("test", async () => {
        toast.success((await call<{ message: string }>("POST", "/api/integrations", { storeId, kind })).message);
      }),
    remove: () =>
      run("remove", async () => {
        await call("DELETE", "/api/integrations", { storeId, kind });
        toast.success("Removed");
        onChange();
      }),
  };
}

function PaymentCard({ storeId, saved, webhooks, onChange }: { storeId: string; saved?: IntegrationView; webhooks: Listing["webhooks"]; onChange: () => void }) {
  const [provider, setProvider] = useState<PaymentProvider>((saved?.provider as PaymentProvider) ?? "own_razorpay");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(saved?.config ?? {}).map(([k, v]) => [k, String(v)])));
  const [enabled, setEnabled] = useState(saved?.enabled ?? true);
  const r = useRunner(storeId, "payment", onChange);
  const spec = PAYMENT_PROVIDERS[provider];
  const same = saved?.provider === provider;
  const submit = () => {
    const config = Object.fromEntries(spec.fields.filter((f) => !f.secret).map((f) => [f.key, values[f.key] ?? ""]));
    const secrets = Object.fromEntries(spec.fields.filter((f) => f.secret).map((f) => [f.key, values[f.key] ?? ""]));
    r.save(provider, config, secrets, enabled, () => setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => !spec.fields.find((f) => f.key === k)?.secret))));
  };
  return (
    <div className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal"><CreditCard className="size-5 text-primary" aria-hidden /> Payment gateway</h3>
        {saved && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {enabled ? "In use at checkout" : "Off: PowerProof's Razorpay is used"}
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Use this gateway at checkout" />
          </label>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Buyers pay straight into your own account instead of PowerProof&apos;s Razorpay. No platform fee on these sales, and they don&apos;t go through Payouts. Refunds are made from your gateway.</p>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Provider</span>
        <Segmented label="Payment provider" value={provider} onChange={setProvider} options={(Object.keys(PAYMENT_PROVIDERS) as PaymentProvider[]).map((p) => ({ value: p, label: PAYMENT_PROVIDERS[p].label }))} className="self-start" />
        <p className="text-xs text-muted-foreground">{spec.about}</p>
      </div>
      {spec.fields.map((f) => <Field key={`${provider}-${f.key}`} spec={f} value={values[f.key] ?? ""} saved={same && saved?.secrets.includes(f.key)} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} />)}
      {provider === "stripe" && <CopyField label="Stripe webhook address" value={webhooks.stripe} toastText="Address copied" />}
      {provider === "custom" && (
        <details className="rounded-control border bg-surface-sunken p-3 text-xs">
          <summary className="cursor-pointer font-semibold">How a custom gateway connects</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground">
            <li>At checkout we POST JSON to your create-payment URL: <code className="font-mono">orderId, ref, amount</code> (smallest unit, e.g. paise), <code className="font-mono">currency, description, buyer, returnUrl, webhookUrl</code>. Headers: <code className="font-mono">Authorization: Bearer &lt;API key&gt;</code> and <code className="font-mono">X-PowerProof-Signature</code>.</li>
            <li>Answer with <code className="font-mono">{"{ \"paymentUrl\": \"https://…\" }"}</code>. We send the buyer there.</li>
            <li>When paid, POST <code className="font-mono">{"{ orderId, paymentId, status: \"paid\", amount, currency }"}</code> to the webhook address below, signed the same way. Send the buyer to <code className="font-mono">returnUrl</code>.</li>
            <li>The signature is HMAC-SHA256 of the raw body with your signing secret, in hex.</li>
          </ol>
          <CopyField className="mt-3" label="Webhook address" value={webhooks.custom} toastText="Address copied" />
        </details>
      )}
      <Actions busy={r.busy} saved={!!saved} onSave={submit} onTest={r.test} onRemove={r.remove} />
    </div>
  );
}

const pretty = (v: unknown) => (v && typeof v === "object" && Object.keys(v).length ? JSON.stringify(v, null, 2) : "");

function AiCard({ storeId, saved, onChange }: { storeId: string; saved?: IntegrationView; onChange: () => void }) {
  const c = saved?.config ?? {};
  const [provider, setProvider] = useState<AiProvider>((saved?.provider as AiProvider) ?? "openai");
  const [baseUrl, setBaseUrl] = useState(String(c.baseUrl ?? AI_PROVIDERS[provider].baseUrl));
  const [route, setRoute] = useState(String(c.route ?? ""));
  const [model, setModel] = useState(String(c.model ?? AI_PROVIDERS[provider].models[0]));
  const [apiKey, setApiKey] = useState("");
  const [extra, setExtra] = useState(pretty(c.extra));
  const [headers, setHeaders] = useState(pretty(c.headers));
  const use = (c.use ?? {}) as { builder?: boolean; pages?: boolean };
  const [useBuilder, setUseBuilder] = useState(use.builder !== false);
  const [usePages, setUsePages] = useState(use.pages !== false);
  const [enabled, setEnabled] = useState(saved?.enabled ?? true);
  const [jsonError, setJsonError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const r = useRunner(storeId, "ai", onChange);
  const spec = AI_PROVIDERS[provider];

  const pick = (p: AiProvider) => {
    // A provider's usual address and model, unless they were typed in
    if (baseUrl === AI_PROVIDERS[provider].baseUrl) setBaseUrl(AI_PROVIDERS[p].baseUrl);
    if (AI_PROVIDERS[provider].models.includes(model)) setModel(AI_PROVIDERS[p].models[0]);
    setProvider(p);
  };
  const parse = (label: string, text: string): Record<string, unknown> | null => {
    if (!text.trim()) return {};
    try {
      const v = JSON.parse(text);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {
      /* below */
    }
    setJsonError(`${label} must be a JSON object, like { "temperature": 0.7 }.`);
    return null;
  };
  const config = () => {
    setJsonError(undefined);
    const e = parse("Extra request options", extra);
    const h = parse("Extra headers", headers);
    if (!e || !h) return null;
    return { baseUrl: baseUrl.trim(), route: route.trim(), model: model.trim(), extra: e, headers: h, use: { builder: useBuilder, pages: usePages } };
  };
  const submit = () => {
    const cfg = config();
    if (cfg) r.save(provider, cfg, apiKey ? { apiKey } : {}, enabled, () => setApiKey(""));
  };
  const exportFile = () => {
    const cfg = config();
    if (!cfg) return;
    const blob = new Blob([JSON.stringify({ powerproof: "integration", kind: "ai", provider, config: cfg }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-${provider}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const parsed = integrationFileSchema.parse(JSON.parse(await f.text()));
      if (parsed.kind !== "ai" || !(parsed.provider in AI_PROVIDERS)) throw new Error();
      const x = parsed.config;
      setProvider(parsed.provider as AiProvider);
      if (typeof x.baseUrl === "string") setBaseUrl(x.baseUrl);
      if (typeof x.route === "string") setRoute(x.route);
      if (typeof x.model === "string") setModel(x.model);
      setExtra(pretty(x.extra));
      setHeaders(pretty(x.headers));
      toast.success("Settings loaded", { description: "Add the API key, then save." });
    } catch {
      toast.error("That file isn't a PowerProof AI settings file.");
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal"><Bot className="size-5 text-primary" aria-hidden /> AI provider</h3>
        {saved && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {enabled ? "In use" : "Off: PowerProof's AI is used"}
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Use this AI provider" />
          </label>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Run AI Studio and AI page building on your own model and key, with no daily allowance.</p>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Provider</span>
        <Segmented label="AI provider" value={provider} onChange={pick} options={(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => ({ value: p, label: AI_PROVIDERS[p].label }))} className="self-start" />
        <p className="text-xs text-muted-foreground">{spec.about}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <Field spec={{ key: "baseUrl", label: "Base URL", url: true }} value={baseUrl} onChange={setBaseUrl} />
        <Field spec={{ key: "route", label: "Route", optional: true, placeholder: provider === "anthropic" ? "/messages" : provider === "gemini" ? "(uses the model)" : "/chat/completions" }} value={route} onChange={setRoute} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-model">Model</Label>
        <Input id="ai-model" list="ai-models" className="font-mono" value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id="ai-models">{spec.models.map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <Field spec={{ key: "apiKey", label: "API key", secret: true }} value={apiKey} saved={saved?.provider === provider && saved.secrets.includes("apiKey")} onChange={setApiKey} />
      <details className="rounded-control border p-3">
        <summary className="cursor-pointer text-[0.8125rem] font-medium">Advanced: request options and headers (JSON)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-extra">Extra request options</Label>
            <Textarea id="ai-extra" className="min-h-20 font-mono text-xs" placeholder={'{ "temperature": 0.7, "max_tokens": 16000 }'} value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-headers">Extra headers</Label>
            <Textarea id="ai-headers" className="min-h-16 font-mono text-xs" placeholder={'{ "HTTP-Referer": "https://yourstore.in" }'} value={headers} onChange={(e) => setHeaders(e.target.value)} />
          </div>
          {jsonError && <p role="alert" className="text-sm font-medium text-danger">{jsonError}</p>}
        </div>
      </details>
      <fieldset className="flex flex-col gap-1">
        <legend className={cn("mb-1", fieldLabel)}>Use it for</legend>
        <label className="flex min-h-9 items-center justify-between gap-3"><span className="text-sm">AI Studio (Create with AI)</span><Switch checked={useBuilder} onCheckedChange={setUseBuilder} /></label>
        <label className="flex min-h-9 items-center justify-between gap-3"><span className="text-sm">Building pages in the editor</span><Switch checked={usePages} onCheckedChange={setUsePages} /></label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={exportFile}><Download aria-hidden /> Save settings as JSON</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => file.current?.click()}><Upload aria-hidden /> Load from JSON</Button>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <Actions busy={r.busy} saved={!!saved} onSave={submit} onTest={r.test} onRemove={r.remove} />
    </div>
  );
}
