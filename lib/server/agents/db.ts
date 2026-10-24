import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentsDatabase } from "@/lib/agents-database.types";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Filters, StoreDb } from "./runtime/types";

/**
 * Database access for agents. `agentsAdmin` is the service role (server only, after access is
 * checked); `agentsAsUser` is the signed-in person, so RLS and store_can() decide. `storeDb` is
 * what steps get: every query is pinned to one store.
 */

export type AgentsSb = SupabaseClient<AgentsDatabase>;

let admin: AgentsSb | null = null;
export function agentsAdmin(): AgentsSb {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  admin ??= createClient<AgentsDatabase>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export async function agentsAsUser(): Promise<AgentsSb> {
  const store = await cookies();
  return createServerClient<AgentsDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a server component: the proxy refreshes the cookie instead */
        }
      },
    },
  }) as unknown as AgentsSb;
}

export class DbError extends Error {}

export function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw new DbError(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<Q extends { eq: any; in: any; lt: any; lte: any; gt: any; gte: any; neq: any; is: any }>(q: Q, filters: Filters = {}): Q {
  let out = q;
  for (const [col, f] of Object.entries(filters)) {
    if (Array.isArray(f)) out = out.in(col, f);
    else if (f !== null && typeof f === "object") out = out[f.op](col, f.value);
    else if (f === null) out = out.is(col, null);
    else out = out.eq(col, f);
  }
  return out;
}

/** Large `in` lists are split so the request URL stays short */
const CHUNK = 150;

export function storeDb(storeId: string, sb: AgentsSb = agentsAdmin()): StoreDb {
  return {
    async select<T>(table: string, columns: string, filters: Filters = {}, opts: { order?: { column: string; ascending?: boolean }; limit?: number } = {}) {
      const big = Object.entries(filters).find(([, f]) => Array.isArray(f) && f.length > CHUNK);
      if (big) {
        const [col, values] = big as [string, unknown[]];
        if (!values.length) return [];
        const parts: T[] = [];
        for (let i = 0; i < values.length; i += CHUNK) parts.push(...(await this.select<T>(table, columns, { ...filters, [col]: values.slice(i, i + CHUNK) as never }, opts)));
        return parts;
      }
      if (Object.values(filters).some((f) => Array.isArray(f) && f.length === 0)) return [];
      // Paged reads: PostgREST answers 1000 rows at most per request
      const out: T[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        let q = applyFilters(sb.from(table).select(columns).eq("store_id", storeId), filters);
        if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.ascending ?? true });
        const to = opts.limit ? Math.min(from + page, opts.limit) - 1 : from + page - 1;
        const rows = must(await q.range(from, to), `read ${table}`) as unknown as T[];
        out.push(...rows);
        if (rows.length < page || (opts.limit && out.length >= opts.limit)) break;
      }
      return out;
    },
    async insert(table, rows) {
      if (!rows.length) return;
      must(await sb.from(table).insert(rows.map((r) => ({ ...r, store_id: storeId }))), `write ${table}`);
    },
    async upsert(table, rows, onConflict, opts) {
      if (!rows.length) return;
      must(await sb.from(table).upsert(rows.map((r) => ({ ...r, store_id: storeId })), { onConflict, ignoreDuplicates: opts?.ignoreDuplicates }), `write ${table}`);
    },
    async update(table, patch, filters) {
      const { store_id: _ignored, ...rest } = patch;
      must(await applyFilters(sb.from(table).update(rest as never).eq("store_id", storeId), filters), `update ${table}`);
    },
  };
}
