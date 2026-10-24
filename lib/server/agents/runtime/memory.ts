import type { ReserveResult } from "../messaging/pipeline";
import type { Ports } from "./context";
import type { ActionItemInput, Connection, Filters, Primitive, StoreDb } from "./types";

/**
 * In-memory stand-ins for the platform ports, used by unit tests (agents' and the platform's) so a
 * whole run can be exercised with no database or network. They follow the same rules as the
 * database functions: idempotency keys, opt-outs, per-contact and daily caps, credit balance.
 */

type Row = Record<string, unknown>;

function matches(row: Row, filters: Filters = {}): boolean {
  return Object.entries(filters).every(([k, f]) => {
    const v = row[k] as Primitive;
    if (Array.isArray(f)) return f.includes(v);
    if (f !== null && typeof f === "object") {
      const x = f.value as Primitive;
      if (f.op === "neq") return v !== x;
      if (f.op === "is") return v === x;
      if (v === null || v === undefined || x === null) return false;
      if (f.op === "lt") return v < x;
      if (f.op === "lte") return v <= x;
      if (f.op === "gt") return v > x;
      return v >= x;
    }
    return v === f;
  });
}

let seq = 0;
export const memoryId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export class MemoryDb implements StoreDb {
  tables = new Map<string, Row[]>();
  /** What created_at says for new rows (tests move it with their own clock) */
  now = () => new Date();
  constructor(readonly storeId: string) {}
  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  seed(table: string, rows: Row[]) {
    for (const r of rows) this.rows(table).push({ id: memoryId(), store_id: this.storeId, created_at: this.now().toISOString(), edited: false, ...r });
  }
  async select<T>(table: string, _columns: string, filters?: Filters, opts?: { order?: { column: string; ascending?: boolean }; limit?: number }): Promise<T[]> {
    let out = this.rows(table).filter((r) => r.store_id === this.storeId && matches(r, filters));
    if (opts?.order) out = [...out].sort((a, b) => String(a[opts.order!.column]).localeCompare(String(b[opts.order!.column])) * (opts.order!.ascending === false ? -1 : 1));
    return structuredClone(opts?.limit ? out.slice(0, opts.limit) : out) as T[];
  }
  async insert(table: string, rows: Row[]) {
    this.seed(table, rows);
  }
  async upsert(table: string, rows: Row[], onConflict: string, opts?: { ignoreDuplicates?: boolean }) {
    const keys = onConflict.split(",").map((k) => k.trim());
    for (const row of rows) {
      const r: Row = { ...row, store_id: this.storeId };
      const hit = this.rows(table).find((x) => x.store_id === this.storeId && keys.every((k) => x[k] === r[k]));
      if (hit && opts?.ignoreDuplicates) continue;
      if (hit) Object.assign(hit, r);
      else this.seed(table, [r]);
    }
  }
  async update(table: string, patch: Row, filters: Filters) {
    for (const r of this.rows(table)) if (r.store_id === this.storeId && matches(r, filters)) Object.assign(r, patch);
  }
}

/** The platform side of a store: outbox, credits, opt-outs, actions, LLM cache and email log */
export class MemoryPlatform {
  outbox: { id: string; key: string; contactKey: string; to: string; status: string; at: number; channel: string }[] = [];
  ledger: { delta: number; key: string; reason: string }[] = [];
  optOuts = new Set<string>();
  actions: ActionItemInput[] = [];
  emails: { to: string; subject: string; text: string }[] = [];
  cache = new Map<string, { subject: string | null; body: string }>();
  modelCalls: string[] = [];
  connections: Connection[] = [];
  stopped = false;

  balance = () => this.ledger.reduce((n, l) => n + l.delta, 0);

  grant(n: number, key = `grant:${this.ledger.length}`) {
    if (!this.ledger.some((l) => l.key === key)) this.ledger.push({ delta: n, key, reason: "grant" });
  }

  ports(db: StoreDb, o: { now: () => Date; answer?: () => string | Error; deliver?: (to: string) => { ok: true } | { ok: false; error: string } }): Ports {
    return {
      db,
      connection: async (type) => this.connections.find((c) => c.type === type) ?? null,
      llm: {
        provider: o.answer
          ? {
              id: "gemini",
              complete: async ({ user }) => {
                this.modelCalls.push(user);
                const a = o.answer!();
                if (a instanceof Error) throw a;
                return { text: a, model: "test", inputTokens: 1, outputTokens: 1 };
              },
            }
          : null,
        cache: { get: async (k) => this.cache.get(k) ?? null, put: async (k, v) => void this.cache.set(k, v) },
        meter: async () => {},
      },
      messaging: {
        stopped: async () => this.stopped,
        smsEnabled: false,
        reserve: async (r): Promise<ReserveResult> => {
          const dup = this.outbox.find((m) => m.key === r.idempotencyKey);
          if (dup) return { result: "duplicate", outboxId: dup.id, status: dup.status };
          if (this.optOuts.has(r.to.toLowerCase())) return { result: "opted_out" };
          const since = o.now().getTime() - r.limits.capDays * 86_400_000;
          const live = this.outbox.filter((m) => m.status !== "failed");
          if (live.filter((m) => m.contactKey === r.contactKey && m.at >= since).length >= r.limits.capMessages) return { result: "frequency_cap" };
          if (live.filter((m) => m.at >= o.now().getTime() - 86_400_000).length >= r.limits.dailyCap) return { result: "daily_cap" };
          if (this.balance() < r.credits) return { result: "no_credits" };
          const id = memoryId();
          this.outbox.push({ id, key: r.idempotencyKey, contactKey: r.contactKey, to: r.to, status: "pending", at: o.now().getTime(), channel: r.channel });
          if (r.credits) this.ledger.push({ delta: -r.credits, key: `charge:${r.idempotencyKey}`, reason: r.creditReason });
          return { result: "reserved", outboxId: id };
        },
        deliverEmail: async (m) => {
          const r = o.deliver?.(m.to) ?? { ok: true as const };
          if (r.ok) this.emails.push({ to: m.to, subject: m.subject, text: m.text });
          return r.ok ? { ok: true, id: `email_${this.emails.length}` } : r;
        },
        finish: async (id, f) => {
          const m = this.outbox.find((x) => x.id === id)!;
          m.status = f.status;
          if (f.status === "failed") {
            const charge = this.ledger.find((l) => l.key === `charge:${m.key}`);
            if (charge && !this.ledger.some((l) => l.key === `release:${m.key}`)) this.ledger.push({ delta: -charge.delta, key: `release:${m.key}`, reason: "release" });
          }
        },
        enqueueAction: async (a) => void (this.actions.some((x) => x.idempotencyKey === a.idempotencyKey) || this.actions.push(a)),
        optOutUrl: () => "https://powerproof.app/agents/optout/test",
      },
      enqueueAction: async (a) => void (this.actions.some((x) => x.idempotencyKey === a.idempotencyKey) || this.actions.push(a)),
      credits: {
        balance: async () => this.balance(),
        charge: async (n, reason, key) => {
          if (this.ledger.some((l) => l.key === key)) return true;
          if (this.balance() < n) return false;
          this.ledger.push({ delta: -n, key, reason });
          return true;
        },
      },
      log: () => {},
    };
  }
}
