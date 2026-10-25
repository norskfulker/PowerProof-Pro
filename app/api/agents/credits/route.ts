import "server-only";
import { z } from "zod";
import { fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { confirmCreditPurchase, startCreditPurchase } from "@/lib/server/agents/credits";

/** Buy agent credits for a store's workspace: "start" makes the order, "confirm" adds the credits once paid. */
export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("start"), storeId: z.string().uuid(), credits: z.number().int() }),
  z.object({ op: z.literal("confirm"), storeId: z.string().uuid(), orderId: z.string().min(1).max(80), paymentId: z.string().min(1).max(80), signature: z.string().min(1).max(200) }),
]);

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new Error("bad request"), "credits");
  try {
    const user = await requireStoreAgents(b.data.storeId);
    if (b.data.op === "start") return ok(await startCreditPurchase(b.data.storeId, user.id, b.data.credits));
    return ok(await confirmCreditPurchase(b.data.storeId, user.id, b.data));
  } catch (e) {
    return fail(e, "credits");
  }
}
