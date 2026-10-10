import "server-only";
import { NextResponse } from "next/server";
import { gstinChecksum, isValidGstin, parseGstRecord, type GstCompany } from "@/lib/gstin";
import { sbServer } from "@/lib/supabase/server";

/**
 * Live company details for a GSTIN, from a GST data provider the owner connects with
 *   GST_LOOKUP_URL  (the provider's address with {gstin} where the number goes)
 *   GST_LOOKUP_KEY  (their API key; GST_LOOKUP_KEY_HEADER names the header, default x-api-key)
 * The key stays on the server. Only signed-in creators can ask, and nothing is invented: with no
 * provider connected the answer is "not_connected".
 */
export const dynamic = "force-dynamic";

type Reply = { ok: true; company: GstCompany } | { ok: false; code: "invalid" | "not_connected" | "not_found" | "unavailable" | "signed_out"; message: string };
const reply = (body: Reply, status: number) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return reply({ ok: false, code: "signed_out", message: "Log in again to look up a GSTIN." }, 401);

  const gstin = new URL(request.url).searchParams.get("gstin")?.trim().toUpperCase() ?? "";
  if (!isValidGstin(gstin)) {
    return reply({ ok: false, code: "invalid", message: gstin.length === 15 && gstin[14] !== gstinChecksum(gstin.slice(0, 14)) ? "That GSTIN's last character doesn't fit the rest. Check it for a typo." : "GSTINs are 15 characters, like 27ABCPR1234F1Z5." }, 400);
  }

  const template = process.env.GST_LOOKUP_URL;
  const key = process.env.GST_LOOKUP_KEY;
  if (!template || !key) return reply({ ok: false, code: "not_connected", message: "Live GST lookup isn't connected yet." }, 501);

  try {
    const res = await fetch(template.replace("{gstin}", encodeURIComponent(gstin)), {
      headers: { [process.env.GST_LOOKUP_KEY_HEADER || "x-api-key"]: key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return reply({ ok: false, code: "not_found", message: "No registration was found for that GSTIN." }, 404);
    if (!res.ok) {
      console.error(`[gst] provider answered ${res.status}`);
      return reply({ ok: false, code: "unavailable", message: "The GST lookup isn't answering right now. You can fill the details in by hand." }, 502);
    }
    const company = parseGstRecord(await res.json());
    if (!company) return reply({ ok: false, code: "not_found", message: "No registration was found for that GSTIN." }, 404);
    return reply({ ok: true, company }, 200);
  } catch (e) {
    console.error("[gst] lookup failed", e instanceof Error ? e.message : e);
    return reply({ ok: false, code: "unavailable", message: "The GST lookup isn't answering right now. You can fill the details in by hand." }, 502);
  }
}
