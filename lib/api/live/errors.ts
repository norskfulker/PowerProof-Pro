import type { PostgrestError } from "@supabase/supabase-js";
import { ApiError, LimitError } from "../client";

/**
 * Turns database errors into the messages the UI already shows. Plan limits come from the
 * database triggers, so the Upgrade dialog opens on exactly what the server refused.
 */
export function fail(e: Pick<PostgrestError, "message" | "code"> | null | undefined, context: { conflict?: string; notFound?: string } = {}): never {
  const msg = e?.message ?? "";
  if (msg.includes("plan_limit_products")) throw new LimitError("products", "The Free plan includes 1 product. Upgrade to Pro to add more.");
  if (msg.includes("plan_limit_stores")) throw new LimitError("stores", "The Free plan includes 1 store. Upgrade to Pro to open another.");
  if (msg.includes("custom domain needs the Pro plan")) throw new LimitError("customDomain", "Custom domains are part of Pro. Upgrade to connect yours.");
  if (e?.code === "23505") throw new ApiError(context.conflict ?? "That's already taken. Try another.", "conflict");
  if (e?.code === "23514" || e?.code === "22P02" || e?.code === "22023") throw new ApiError("Some details aren't in the right format. Check the form and try again.", "validation");
  if (e?.code === "PGRST116") throw new ApiError(`${context.notFound ?? "That"} not found.`, "not_found");
  if (e?.code === "42501") throw new ApiError("You don't have access to that.", "not_found");
  throw new ApiError("We couldn't reach PowerProof. Check your connection and try again.");
}

/** Unwraps a Supabase result, throwing the mapped error. */
export function must<T>(r: { data: T; error: PostgrestError | null }, context?: Parameters<typeof fail>[1]): NonNullable<T> {
  if (r.error) fail(r.error, context);
  if (r.data === null) fail({ code: "PGRST116", message: "" }, context);
  return r.data as NonNullable<T>;
}
