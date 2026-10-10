import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addDomain, DomainError, getDomain, removeDomain, setPrimary } from "@/lib/server/domains";

/** Connect or remove a store's own domain. Pro plan; the owner, or someone on the team with the design area. */
export const dynamic = "force-dynamic";

const body = z.object({ storeId: z.string().uuid(), host: z.string().max(300).optional() });
const reply = (e: unknown) => {
  if (e instanceof DomainError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
  console.error("[domains]", e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, message: "Something went wrong. Try again in a minute." }, { status: 500 });
};

export async function POST(request: Request) {
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success || !p.data.host) return NextResponse.json({ ok: false, message: "Type the domain you own, like shop.yourname.in." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, domain: await addDomain(p.data.storeId, p.data.host) });
  } catch (e) {
    return reply(e);
  }
}

/** Whether the store's free address sends visitors to this domain */
export async function PATCH(request: Request) {
  const p = z.object({ storeId: z.string().uuid(), primary: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, message: "That request wasn't right." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, domain: await setPrimary(p.data.storeId, p.data.primary) });
  } catch (e) {
    return reply(e);
  }
}

export async function DELETE(request: Request) {
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, message: "That request wasn't right." }, { status: 400 });
  try {
    await removeDomain(p.data.storeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return reply(e);
  }
}

/** The store's domain and the records still to add */
export async function GET(request: Request) {
  const p = z.string().uuid().safeParse(new URL(request.url).searchParams.get("storeId"));
  if (!p.success) return NextResponse.json({ ok: false, message: "That request wasn't right." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await getDomain(p.data)) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return reply(e);
  }
}
