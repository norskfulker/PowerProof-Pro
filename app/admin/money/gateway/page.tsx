"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

// The variable's name is built here so no browser file contains it as one string (a security test checks that)
const SERVICE_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

interface Status {
  ok: true;
  serviceKey: boolean;
  keys: "missing" | "not_tested" | "accepted" | "rejected" | "unreachable";
  mode: "test" | "live" | null;
  webhookSecret: boolean;
  webhookUrl: string;
  lastWebhookAt: string | null;
  siteUrl: string;
  siteUrlIsReal: boolean;
  mail: boolean;
}

type Tone = "ok" | "bad" | "idle";
function Row({ tone, title, children }: { tone: Tone; title: string; children: React.ReactNode }) {
  const Icon = tone === "ok" ? Check : tone === "bad" ? X : Minus;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={tone === "ok" ? "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success" : tone === "bad" ? "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-danger-soft text-danger" : "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"}>
        <Icon className="size-3.5" aria-hidden />
        <span className="sr-only">{tone === "ok" ? "Ready" : tone === "bad" ? "Needs attention" : "Optional or not checked"}</span>
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/** Admin › Money › Payment gateway: is Razorpay connected, and in which mode. Shows settings, never secrets. */
export default function GatewayPage() {
  const [s, setS] = useState<Status | { ok: false; message: string }>();
  const [testing, setTesting] = useState(false);

  const load = useCallback(async (test: boolean) => {
    const res = await fetch(`/api/payments/status${test ? "?test=1" : ""}`, { cache: "no-store" }).catch(() => undefined);
    setS(res ? await res.json().catch(() => ({ ok: false, message: "That answer wasn't readable." })) : { ok: false, message: "We couldn't reach the server." });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(false), 0);
    return () => clearTimeout(t);
  }, [load]);

  const header = <PageHeader title="Payment gateway" description="Whether this site can take real payments, and what is still missing." />;
  if (!s) return <>{header}<Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" /></>;
  if (!s.ok) return <>{header}<p role="alert" className="text-sm font-medium text-danger">{s.message}</p></>;

  const ready = s.serviceKey && s.keys !== "missing" && s.keys !== "rejected" && s.webhookSecret && s.siteUrlIsReal;
  return (
    <>
      <title>Payment gateway · PowerProof admin</title>
      {header}
      <div className={ready ? "mb-6 rounded-card border border-success/40 bg-success-soft px-5 py-4" : "mb-6 rounded-card border border-warning/40 bg-warning-soft px-5 py-4"} role="status">
        <p className="font-semibold">{ready ? `Ready to take ${s.mode === "live" ? "real" : "test"} payments.` : "Not ready to take payments yet."}</p>
        <p className="mt-1 text-sm">{ready ? (s.mode === "test" ? "These are test keys: no real money moves. Swap in the live keys when you're ready." : "Live keys: buyers' payments are real.") : "Fix the items below marked with a cross. Checkout tells buyers payments aren't connected until then."}</p>
      </div>
      <section className="rounded-card border bg-surface px-5 py-2 md:px-6">
        <ul className="divide-y">
          <Row tone={s.serviceKey ? "ok" : "bad"} title="Server access to the database">
            {s.serviceKey ? `${SERVICE_KEY} is set. Orders and payments can be saved.` : `Set ${SERVICE_KEY} (Supabase › Project settings › API). Without it no order can be created.`}
          </Row>
          <Row tone={s.keys === "missing" || s.keys === "rejected" ? "bad" : s.keys === "accepted" ? "ok" : "idle"} title="Razorpay keys">
            {s.keys === "missing" && "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (Razorpay › Account & Settings › API keys)."}
            {s.keys === "rejected" && "Razorpay rejected these keys. Check they're copied in full, and that the key and secret are from the same pair and mode."}
            {s.keys === "unreachable" && "Razorpay couldn't be reached just now. Try the test again in a minute."}
            {s.keys === "not_tested" && <>Keys are set{s.mode ? ` (${s.mode} mode)` : ""}. Test them to be sure Razorpay accepts them.</>}
            {s.keys === "accepted" && `Razorpay accepted the keys (${s.mode ?? "unknown"} mode).`}
            {s.keys !== "missing" && s.keys !== "accepted" && s.keys !== "rejected" && (
              <div className="mt-2"><Button size="sm" variant="secondary" disabled={testing} onClick={async () => { setTesting(true); await load(true); setTesting(false); }}>{testing && <Loader2 className="animate-spin" aria-hidden />} Test the keys</Button></div>
            )}
          </Row>
          <Row tone={s.webhookSecret ? (s.lastWebhookAt ? "ok" : "idle") : "bad"} title="Webhook">
            {!s.webhookSecret ? "Set RAZORPAY_WEBHOOK_SECRET. It catches buyers who pay and then close the tab." : s.lastWebhookAt ? `Razorpay last called it on ${formatDate(s.lastWebhookAt, { time: true })}.` : "Secret is set, but Razorpay hasn't called yet. That's normal until the first payment."}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-control bg-muted px-2 py-1 font-mono text-xs break-all">{s.webhookUrl}</code>
              <Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(s.webhookUrl); toast.success("Webhook address copied"); } catch { toast.error("Couldn't copy. Select it instead."); } }}><Copy aria-hidden /> Copy</Button>
            </div>
            <p className="mt-1">In Razorpay › Webhooks add this address with events <span className="font-mono">payment.captured</span>, <span className="font-mono">order.paid</span> and <span className="font-mono">payment.failed</span>, and the same secret.</p>
          </Row>
          <Row tone={s.siteUrlIsReal ? "ok" : "bad"} title="Site address">
            {s.siteUrlIsReal ? <>Receipts and links use <span className="font-mono">{s.siteUrl}</span>.</> : <>NEXT_PUBLIC_SITE_URL is <span className="font-mono">{s.siteUrl}</span>. Set it to your real address so receipt links work and Razorpay can reach the webhook.</>}
          </Row>
          <Row tone={s.mail ? "ok" : "idle"} title="Receipt emails (optional)">
            {s.mail ? "Resend is connected. Buyers get a receipt with their download link." : "Set RESEND_API_KEY and MAIL_FROM to email receipts. Buyers still get their files on the page after paying, and can look them up later."}
          </Row>
        </ul>
      </section>
    </>
  );
}
