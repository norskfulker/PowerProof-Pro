import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mailConfigured, sendMail, storeClaimMail } from "@/lib/server/email";
import { siteUrl } from "@/lib/site-url";
import { sbServer } from "@/lib/supabase/server";

/**
 * Sends a store to someone by email: a transfer from its owner, or a claim link from PowerProof
 * staff for a store they built. The database's store_claim_create decides who may and what kind
 * it is; this route adds the email. The link is returned too, to share another way.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  storeId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("That email looks off. Check for typos.").max(254),
  keepPrevious: z.boolean().default(false),
  note: z.string().trim().max(280, "Keep the note under 280 characters.").optional(),
});

const REASONS: Record<string, [string, number]> = {
  owner_only: ["Only the store's owner can hand it over.", 403],
  bad_email: ["That email looks off. Check for typos.", 400],
  is_owner: ["That's the owner's own email.", 400],
  store_not_found: ["That store doesn't exist any more.", 404],
  signed_out: ["Log in again to do this.", 401],
};

export async function POST(request: Request) {
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, message: p.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: REASONS.signed_out[0] }, { status: 401 });

  const r = await db.rpc("store_claim_create", { p_store: p.data.storeId, p_email: p.data.email, p_keep_previous: p.data.keepPrevious, p_note: p.data.note ?? undefined });
  if (r.error) {
    const key = Object.keys(REASONS).find((k) => r.error!.message.includes(k));
    if (!key) console.error("[claims]", r.error.message);
    const [message, status] = key ? REASONS[key] : ["The link didn't go out. Try again.", 500];
    return NextResponse.json({ ok: false, code: key, message }, { status });
  }
  const out = r.data as { token: string; email: string; kind: "transfer" | "claim"; blocker: string | null };
  const link = `${siteUrl()}/claim/${out.token}`;

  let emailed = false;
  if (mailConfigured()) {
    const [{ data: store }, { data: me }] = await Promise.all([
      db.from("stores").select("name").eq("id", p.data.storeId).single(),
      db.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    ]);
    const mail = storeClaimMail({ storeName: store?.name ?? "a store", from: me?.full_name || auth.user.email || "The store owner", kind: out.kind, note: p.data.note, acceptUrl: link, email: out.email });
    emailed = (await sendMail({ to: out.email, ...mail })).sent;
  }
  return NextResponse.json({ ok: true, emailed, link, blocker: out.blocker }, { headers: { "cache-control": "no-store" } });
}
