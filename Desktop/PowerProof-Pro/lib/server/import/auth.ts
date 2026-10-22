import "server-only";
import { NextResponse } from "next/server";
import { sbServer } from "../../supabase/server";

/**
 * The signed-in creator and a store whose catalog they may change (its owner, or someone on its
 * team with the Products area). Published stores are readable by anyone, so reading the row alone
 * doesn't prove access: store_can does.
 */
export async function ownStore(storeId: unknown) {
  if (typeof storeId !== "string" || !/^[0-9a-f-]{36}$/i.test(storeId)) return { error: NextResponse.json({ ok: false, message: "Which store?" }, { status: 400 }) } as const;
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 }) } as const;
  const { data: ok } = await sb.rpc("store_can", { p_store: storeId, p_area: "catalog" });
  const { data: store } = ok === true ? await sb.from("stores").select("id, name, slug, currency_base, support_email").eq("id", storeId).maybeSingle() : { data: null };
  if (!store) return { error: NextResponse.json({ ok: false, message: "We can't find that store." }, { status: 404 }) } as const;
  return { sb, user: auth.user, store } as const;
}

export const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status, headers: { "cache-control": "no-store" } });
