import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mailConfigured, sendMail, teamInviteMail } from "@/lib/server/email";
import { siteUrl } from "@/lib/server/shop";
import { sbServer } from "@/lib/supabase/server";
import { ALL_AREAS, areaLabels } from "@/lib/team";

/**
 * Invites someone to a store's team. The database's team_invite checks who is asking (the owner
 * or an admin), the plan's seats and the role; this route only adds the email, which needs the
 * mail key. The link is returned too, so it can be shared another way when email isn't connected.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  storeId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("That email looks off. Check for typos.").max(254),
  role: z.enum(["admin", "member"]),
  areas: z.array(z.enum(ALL_AREAS as [string, ...string[]])).max(ALL_AREAS.length),
});

const REASONS: Record<string, [string, number]> = {
  not_allowed: ["Only the store's owner and admins can invite people.", 403],
  owner_only: ["Only the store's owner can make admins.", 403],
  no_areas: ["Pick at least one part of the store they can work on.", 400],
  bad_email: ["That email looks off. Check for typos.", 400],
  is_owner: ["That's the store owner's own email.", 400],
  already_member: ["They're already on this store's team.", 409],
  plan_limit_team: ["Your plan's team seats are all used. Remove someone, or upgrade to Pro for more.", 402],
  signed_out: ["Log in again to invite people.", 401],
};

export async function POST(request: Request) {
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, message: p.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: REASONS.signed_out[0] }, { status: 401 });

  const r = await db.rpc("team_invite", { p_store: p.data.storeId, p_email: p.data.email, p_role: p.data.role, p_areas: p.data.areas });
  if (r.error) {
    const key = Object.keys(REASONS).find((k) => r.error!.message.includes(k));
    if (!key) console.error("[team/invite]", r.error.message);
    const [message, status] = key ? REASONS[key] : ["The invite didn't go out. Try again.", 500];
    return NextResponse.json({ ok: false, code: key, message }, { status });
  }
  const out = r.data as { token: string; email: string };
  const link = `${siteUrl()}/invite/${out.token}`;

  let emailed = false;
  if (mailConfigured()) {
    const [{ data: store }, { data: me }] = await Promise.all([
      db.from("stores").select("name").eq("id", p.data.storeId).single(),
      db.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    ]);
    const mail = teamInviteMail({ storeName: store?.name ?? "a store", inviterName: me?.full_name || auth.user.email || "A store owner", role: p.data.role, areas: areaLabels(p.data.areas), acceptUrl: link, email: out.email });
    emailed = (await sendMail({ to: out.email, ...mail })).sent;
  }
  return NextResponse.json({ ok: true, emailed, link }, { headers: { "cache-control": "no-store" } });
}
