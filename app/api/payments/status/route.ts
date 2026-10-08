import "server-only";
import { NextResponse } from "next/server";
import { mailConfigured } from "@/lib/server/email";
import { readRates } from "@/lib/server/fx";
import { keyMode, payoutConfig, razorpayConfig, verifyKeys } from "@/lib/server/razorpay";
import { siteUrl } from "@/lib/server/shop";
import { sbAdmin, serviceKeyConfigured, serviceKeyName } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";

/**
 * Is this deployment ready to take money? PowerProof staff only. Reports which settings are in
 * place and, with ?test=1, asks Razorpay whether the keys are accepted. It never returns a secret.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  const { data: admin } = auth.user ? await db.rpc("is_admin") : { data: false };
  if (!auth.user || !admin) return NextResponse.json({ ok: false, message: "Only PowerProof staff can see this." }, { status: 403 });

  const cfg = razorpayConfig();
  const url = siteUrl();
  let keys: "missing" | "not_tested" | "accepted" | "rejected" | "unreachable" = cfg ? "not_tested" : "missing";
  if (cfg && new URL(request.url).searchParams.get("test") === "1") {
    const r = await verifyKeys(cfg);
    keys = r.ok ? "accepted" : r.reason;
  }
  let lastWebhookAt: string | null = null;
  let fxUpdatedAt: string | null = null;
  let fxCurrencies = 0;
  if (serviceKeyConfigured()) {
    const fx = await readRates();
    fxUpdatedAt = fx.updatedAt;
    fxCurrencies = Object.keys(fx.rates).length;
    const { data } = await sbAdmin().from("webhook_events").select("created_at").eq("gateway", "razorpay").order("created_at", { ascending: false }).limit(1).maybeSingle();
    lastWebhookAt = data?.created_at ?? null;
  }
  return NextResponse.json(
    {
      ok: true,
      serviceKey: !!serviceKeyConfigured(),
      serviceKeyName: serviceKeyName(),
      keys,
      mode: cfg ? keyMode(cfg.keyId) : null,
      webhookSecret: !!cfg?.webhookSecret,
      webhookUrl: `${url}/api/webhooks/razorpay`,
      lastWebhookAt,
      siteUrl: url,
      siteUrlIsReal: !/localhost|127\.0\.0\.1/.test(url),
      mail: mailConfigured(),
      payoutAccount: !!payoutConfig(),
      fxUpdatedAt,
      fxCurrencies,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
