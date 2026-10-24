import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AGENT_CODE } from "@/agents/server";
import { addInvoice, approveReminder, editReminder, exportRows, markPaid, OwnerError, setInvoiceStatus } from "@/agents/payment-chaser/lib/owner-actions";
import { MAX_ROWS, normalizeEmail, normalizePhone } from "@/agents/payment-chaser/lib/parse";
import { toCsv } from "@/lib/csv";
import { allow } from "@/lib/server/limit";
import { AgentError, fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { agentsAdmin, must, storeDb } from "@/lib/server/agents/db";
import { addressHash } from "@/lib/server/agents/optout";
import { businessName, loadStoreInfo } from "@/lib/server/agents/ports";

/**
 * Payment Chaser's owner actions. Every op checks store_can(store, 'agents') first, then writes
 * with the server key pinned to that store. GET ?storeId= downloads the store's data as CSV.
 */
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const ids = z.array(uuid).min(1).max(5000);
const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("import"), storeId: uuid, source: z.enum(["csv", "xlsx"]), fileName: z.string().max(200), isFull: z.boolean(), rows: z.array(z.array(z.string().max(500)).max(40)).min(2).max(MAX_ROWS + 1), mapping: z.record(z.string(), z.number().int().min(0).max(39)).optional() }),
  z.object({ op: z.literal("add_invoice"), storeId: uuid, invoice: z.object({ customerName: z.string().max(120), phone: z.string().max(30).optional(), email: z.string().max(200).optional(), invoiceNo: z.string().max(60), amount: z.string().max(30), paid: z.string().max(30).optional(), dueDate: z.string().max(20), invoiceDate: z.string().max(20).optional() }) }),
  z.object({ op: z.literal("mark_paid"), storeId: uuid, invoiceIds: ids }),
  z.object({ op: z.literal("set_status"), storeId: uuid, invoiceIds: ids, status: z.enum(["open", "paused", "disputed", "written_off"]) }),
  z.object({ op: z.literal("confirm_missing"), storeId: uuid, importId: uuid, invoiceIds: z.array(uuid).max(5000) }),
  z.object({ op: z.literal("update_customer"), storeId: uuid, customerId: uuid, name: z.string().trim().min(1).max(120).optional(), phone: z.string().max(30).nullable().optional(), email: z.string().max(200).nullable().optional(), isPaused: z.boolean().optional(), languagePref: z.enum(["english", "hinglish"]).nullable().optional(), optedOut: z.boolean().optional() }),
  z.object({ op: z.literal("edit_reminder"), storeId: uuid, reminderId: uuid, subject: z.string().max(200).nullable(), body: z.string().max(4000) }),
  z.object({ op: z.literal("approve_reminder"), storeId: uuid, reminderId: uuid }),
  z.object({ op: z.literal("delete_all"), storeId: uuid, confirm: z.literal("DELETE") }),
]);

async function cancelOutbox(outboxIds: string[]) {
  for (const id of outboxIds) await agentsAdmin().rpc("agent_outbox_finish", { p_id: id, p_status: "failed", p_error: "Paid before it was sent." });
}

export async function GET(request: Request) {
  const storeId = uuid.safeParse(new URL(request.url).searchParams.get("storeId"));
  if (!storeId.success) return fail(new AgentError("That request wasn't right."), "chaser");
  try {
    await requireStoreAgents(storeId.data);
    const csv = toCsv(await exportRows(storeDb(storeId.data)));
    return new NextResponse(`﻿${csv}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="payment-chaser-data.csv"', "cache-control": "no-store" } });
  } catch (e) {
    return fail(e, "chaser");
  }
}

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new AgentError(b.error.issues[0]?.path.includes("rows") ? "That file is too big or empty. Up to 5,000 rows." : "That request wasn't right."), "chaser");
  const d = b.data;
  try {
    const user = await requireStoreAgents(d.storeId);
    const db = storeDb(d.storeId);
    const now = new Date();
    const sb = agentsAdmin();
    switch (d.op) {
      case "import": {
        if (!allow(`chaser-import:${user.id}`, 20, 3_600_000)) throw new AgentError("Too many uploads. Try again in an hour.", 429);
        const r = await AGENT_CODE["payment-chaser"].ingest!(db, d.rows, { source: d.source, fileName: d.fileName, mapping: d.mapping, isFull: d.isFull, now, userId: user.id, newId: randomUUID });
        if (!r.ok) throw new AgentError(r.message ?? "The file couldn't be read.");
        return ok({ summary: r.summary });
      }
      case "add_invoice":
        return ok({ summary: await addInvoice(db, d.invoice, now, randomUUID, user.id) });
      case "mark_paid": {
        const r = await markPaid(db, d.invoiceIds, now);
        await cancelOutbox(r.cancelledOutbox);
        return ok();
      }
      case "set_status": {
        const r = await setInvoiceStatus(db, d.invoiceIds, d.status, now);
        await cancelOutbox(r.cancelledOutbox);
        return ok();
      }
      case "confirm_missing": {
        const [imp] = await db.select<{ missing_invoice_ids: string[] }>("chaser_imports", "missing_invoice_ids", { id: d.importId });
        if (!imp) throw new AgentError("That upload wasn't found.", 404);
        const allowed = d.invoiceIds.filter((i) => imp.missing_invoice_ids.includes(i));
        if (allowed.length) await cancelOutbox((await markPaid(db, allowed, now)).cancelledOutbox);
        await db.update("chaser_imports", { status: "done" }, { id: d.importId });
        return ok({ marked: allowed.length });
      }
      case "update_customer": {
        const patch: Record<string, unknown> = { updated_at: now.toISOString() };
        if (d.name !== undefined) patch.name = d.name;
        if (d.isPaused !== undefined) patch.is_paused = d.isPaused;
        if (d.languagePref !== undefined) patch.language_pref = d.languagePref;
        if (d.phone !== undefined) {
          const p = d.phone ? normalizePhone(d.phone) : null;
          if (d.phone && !p) throw new AgentError("That mobile number doesn't look right.");
          patch.phone_e164 = p;
        }
        if (d.email !== undefined) {
          const e = d.email ? normalizeEmail(d.email) : null;
          if (d.email && !e) throw new AgentError("That email doesn't look right.");
          patch.email = e;
        }
        if (d.optedOut !== undefined) patch.opted_out_at = d.optedOut ? now.toISOString() : null;
        const { error } = await sb.from("chaser_customers").update(patch).eq("store_id", d.storeId).eq("id", d.customerId);
        if (error) throw new AgentError(error.message.includes("chaser_customers_phone") ? "Another customer already has that mobile number." : "We couldn't save that.");
        if (d.optedOut !== undefined || d.isPaused) {
          const [c] = await db.select<{ phone_e164: string | null; email: string | null }>("chaser_customers", "phone_e164, email", { id: d.customerId });
          const rows = [c?.email ? { channel: "email", address_hash: addressHash("email", c.email) } : null, c?.phone_e164 ? { channel: "whatsapp", address_hash: addressHash("whatsapp", c.phone_e164) } : null].filter(Boolean) as { channel: string; address_hash: string }[];
          if (d.optedOut === true) for (const r of rows) await sb.from("agent_optouts").upsert({ store_id: d.storeId, ...r, source: "owner" }, { onConflict: "store_id,channel,address_hash", ignoreDuplicates: true });
          if (d.optedOut === false) for (const r of rows) await sb.from("agent_optouts").delete().eq("store_id", d.storeId).eq("channel", r.channel).eq("address_hash", r.address_hash);
          // Paused or opted out: nothing waiting for them goes out
          const waiting = await db.select<{ id: string; provider_message_id: string | null; status: string }>("chaser_reminders", "id, provider_message_id, status", { customer_id: d.customerId, status: ["drafted", "approved", "queued", "snoozed"] });
          if (d.isPaused || d.optedOut) {
            for (const w of waiting) {
              await db.update("chaser_reminders", { status: "skipped", error: d.optedOut ? "Customer opted out." : "Customer paused.", updated_at: now.toISOString() }, { id: w.id });
              await db.update("agent_action_items", { status: "skipped", done_at: now.toISOString() }, { ref_id: w.id, status: ["open", "snoozed"] });
            }
            await cancelOutbox(waiting.filter((w) => w.status === "queued" && w.provider_message_id).map((w) => w.provider_message_id!));
          }
        }
        return ok();
      }
      case "edit_reminder":
        await editReminder(db, d.reminderId, d.subject, d.body, now);
        return ok();
      case "approve_reminder": {
        const { data: inst } = await sb.from("agent_instances").select("settings").eq("store_id", d.storeId).eq("agent_id", "payment-chaser").maybeSingle();
        await approveReminder(db, d.reminderId, (inst?.settings as Record<string, unknown>) ?? {}, businessName(await loadStoreInfo(d.storeId)), now);
        return ok();
      }
      case "delete_all": {
        // Everything Payment Chaser holds for this store. Credits history stays (it's the store's billing record).
        for (const t of ["chaser_reminders", "chaser_invoices", "chaser_imports", "chaser_customers"]) must(await sb.from(t).delete().eq("store_id", d.storeId), `delete ${t}`);
        must(await sb.from("agent_instances").delete().eq("store_id", d.storeId).eq("agent_id", "payment-chaser"), "delete agent");
        return ok();
      }
    }
  } catch (e) {
    if (e instanceof OwnerError) return fail(new AgentError(e.message), "chaser");
    return fail(e, "chaser");
  }
}
