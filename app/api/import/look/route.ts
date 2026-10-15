import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ownStore } from "@/lib/server/import/auth";
import { ImportError } from "@/lib/server/import/sources";
import { readLook } from "@/lib/server/import/theme";
import { allow, clientKey } from "@/lib/server/limit";

/**
 * Reads another store's look from its address (colours, fonts, corners, its home page's kinds of
 * sections) so the creator can start from it. Only the look: no text, pictures or code are taken.
 * Nothing is saved here; the editor applies it as a draft.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ storeId: z.string(), url: z.string().trim().min(3).max(2000) });

export async function POST(request: Request) {
  if (!allow(`look:${clientKey(request)}`, 20, 10 * 60_000)) return fail("Too many in a row. Wait a few minutes.", 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Paste the store's address.");
  const own = await ownStore(parsed.data.storeId);
  if ("error" in own) return own.error;
  try {
    return NextResponse.json({ ok: true, look: await readLook(parsed.data.url) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ImportError) return fail(e.message);
    console.error("[import/look]", e instanceof Error ? e.message : e);
    return fail("We couldn't read that site. Try again.", 500);
  }
}
