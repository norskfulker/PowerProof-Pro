import "server-only";
import { NextResponse } from "next/server";
import { directGatewayFor, stripePaid } from "@/lib/server/gateways";
import { completePayment, siteUrl } from "@/lib/server/shop";
import { sbAdmin } from "@/lib/supabase/admin";

/**
 * Where buyers come back to after paying on a store's own gateway's page (Stripe, custom).
 * Stripe is asked directly whether the session was paid; a custom gateway confirms by its
 * webhook, so if that hasn't arrived yet the buyer is told their order is being confirmed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("o") ?? "";
  const pending = NextResponse.redirect(`${siteUrl()}/lookup?pending=1`, 303);
  if (!id || id.length > 200) return pending;
  const db = sbAdmin();
  const { data: o } = await db.from("orders").select("id, store_id, gateway, status, total_minor, currency").eq("gateway_order_id", id).maybeSingle();
  if (!o) return pending;

  try {
    if (o.status !== "paid" && o.gateway === "stripe") {
      const gw = await directGatewayFor(o.store_id);
      const paymentId = gw?.provider === "stripe" ? await stripePaid(gw, id, Number(o.total_minor), o.currency) : null;
      if (paymentId) {
        const done = await completePayment(id, paymentId, undefined, true);
        return NextResponse.redirect(`${siteUrl()}/success/${done.orderId}?t=${done.token}`, 303);
      }
    }
    if (o.status === "paid") {
      // Already confirmed (by the webhook): a fresh link for this visit
      const t = await db.rpc("issue_download_token", { p_order: o.id });
      if (t.data) return NextResponse.redirect(`${siteUrl()}/success/${o.id}?t=${t.data}`, 303);
    }
  } catch (e) {
    console.error("[checkout/return]", e instanceof Error ? e.message : e);
  }
  return pending;
}
