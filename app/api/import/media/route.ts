import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ownStore } from "@/lib/server/import/auth";
import { allow, clientKey } from "@/lib/server/limit";
import { safeFetch } from "@/lib/server/safe-fetch";
import { sbAdmin } from "@/lib/supabase/admin";

/**
 * Copies a product's pictures (and its video) into the store's own media library, so nothing points
 * at the old store. Only real images (PNG, JPEG, WebP, GIF) and videos (MP4, WebM), 10 MB at most
 * each. A file that can't be copied comes back empty and the product simply has one fewer.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" };
const body = z.object({ storeId: z.string(), urls: z.array(z.string().url().max(2048)).min(1).max(24) });

/** The file really is that kind of image or video (its first bytes), whatever the server says */
function sniff(b: Uint8Array): string | undefined {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  // MP4's "ftyp" box, but not HEIC/AVIF pictures, which use the same box
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && !/^(heic|heix|hevc|mif1|msf1|avif|avis)$/.test(String.fromCharCode(b[8], b[9], b[10], b[11]))) return "video/mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  return undefined;
}

export async function POST(request: Request) {
  if (!allow(`import-media:${clientKey(request)}`, 400, 10 * 60_000)) return fail("Too many pictures at once. Wait a minute.", 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Check the pictures and try again.");
  const own = await ownStore(parsed.data.storeId);
  if ("error" in own) return own.error;
  const bucket = sbAdmin().storage.from("store-media");
  const out: Record<string, string | null> = {};
  const queue = [...new Set(parsed.data.urls)];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        try {
          const r = await safeFetch(url, { maxBytes: 10 * 1024 * 1024, timeoutMs: 45_000, accept: "image/*,video/mp4,video/webm" });
          const type = r.status === 200 ? sniff(r.bytes) : undefined;
          if (!type) throw new Error("not an image");
          const name = (new URL(r.url).pathname.split("/").pop() ?? "image").replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "image";
          const path = `${own.store.id}/media/${randomUUID()}-${name}.${TYPES[type]}`;
          const up = await bucket.upload(path, r.bytes, { contentType: type, cacheControl: "31536000", upsert: false });
          if (up.error) throw new Error(up.error.message);
          out[url] = bucket.getPublicUrl(path).data.publicUrl;
        } catch {
          out[url] = null;
        }
      }
    })
  );
  return NextResponse.json({ ok: true, urls: out }, { headers: { "cache-control": "no-store" } });
}
