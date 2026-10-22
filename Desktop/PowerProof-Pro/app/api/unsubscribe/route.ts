import "server-only";
import { NextResponse } from "next/server";
import { validUnsubscribe } from "@/lib/server/unsubscribe";
import { sbAdmin } from "@/lib/supabase/admin";

/** The unsubscribe link in store emails: one click, no account. */
export const dynamic = "force-dynamic";

const page = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#f7f7f5;color:#0b100e;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:28rem;padding:2rem;text-align:center"><h1 style="font-size:1.5rem">${title}</h1><p style="color:#5b6b65">${body}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

async function unsubscribe(url: URL) {
  const storeId = url.searchParams.get("s") ?? "";
  const email = (url.searchParams.get("e") ?? "").toLowerCase();
  const sig = url.searchParams.get("k") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !email.includes("@") || !validUnsubscribe(storeId, email, sig)) return page("That link doesn't work", "It may be incomplete. Use the link in the email again.", 400);
  const db = sbAdmin();
  const { data: store } = await db.from("stores").select("name").eq("id", storeId).maybeSingle();
  await db.from("customer_profiles").upsert({ store_id: storeId, email, unsubscribed_at: new Date().toISOString() }, { onConflict: "store_id,email", ignoreDuplicates: false });
  return page("You're unsubscribed", `${store?.name ?? "The store"} won't send you news any more. You'll still get receipts for anything you buy.`);
}

export const GET = (request: Request) => unsubscribe(new URL(request.url));
// One-click unsubscribe from mail apps (RFC 8058) posts to the same address
export const POST = (request: Request) => unsubscribe(new URL(request.url));
