import "server-only";
import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await currentAdmin();
  return NextResponse.json({ isAdmin: !!admin }, { headers: { "cache-control": "private, no-store" } });
}
