import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDomain, DomainError } from "@/lib/server/domains";

/** Checks whether the DNS records are in place yet. The domain goes live the moment they are. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const p = z.object({ storeId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, message: "That request wasn't right." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, domain: await checkDomain(p.data.storeId) });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[domains/verify]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "We couldn't check right now. Try again in a minute." }, { status: 500 });
  }
}
