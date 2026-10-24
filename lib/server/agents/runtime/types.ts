import type { ActionKind, AgentManifest, ConnectorType } from "@/lib/agents/define";

/**
 * What a step can use. The platform builds one per run; `guardCtx` narrows it to what the agent's
 * manifest declares, so a step can't reach a connector, action or credit reason it didn't ask for.
 * Kept free of `server-only` so steps and the engine can be unit tested.
 */

export type Primitive = string | number | boolean | null;
export type Filters = Record<string, Primitive | Primitive[] | { op: "lt" | "lte" | "gt" | "gte" | "neq" | "is"; value: Primitive }>;

/** The store's own rows in the agent's own tables (`manifest.dataPrefix`); store_id is always added */
export interface StoreDb {
  select<T = Record<string, unknown>>(table: string, columns: string, filters?: Filters, opts?: { order?: { column: string; ascending?: boolean }; limit?: number }): Promise<T[]>;
  insert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  upsert(table: string, rows: Record<string, unknown>[], onConflict: string, opts?: { ignoreDuplicates?: boolean }): Promise<void>;
  update(table: string, patch: Record<string, unknown>, filters: Filters): Promise<void>;
}

export interface Connection {
  id: string;
  type: ConnectorType;
  status: "connected" | "needs_reauth" | "error";
  config: Record<string, unknown>;
}

export type Channel = "email" | "sms" | "whatsapp";

export interface DraftRequest {
  /** The agent's prompt name (agents/<id>/prompts/<name>.ts) */
  prompt: string;
  input: Record<string, unknown>;
  /** Placeholders the wording must keep exactly, e.g. {{amount}} */
  required: string[];
  maxChars: number;
  wantsSubject: boolean;
  /** Used when the model fails or its answer doesn't pass the checks */
  fallback: { subject: string | null; body: string };
  cacheKey: string;
}

export interface DraftResult {
  subject: string | null;
  body: string;
  source: "llm" | "cache" | "fallback";
  /** Why the fallback was used */
  reason?: string;
}

export interface OutboundMessage {
  channel: Channel;
  /** Email address or E.164 phone */
  to: string;
  toName?: string;
  subject?: string | null;
  body: string;
  /** Who the frequency cap and opt-out are counted for (e.g. the customer id) */
  contactKey: string;
  idempotencyKey: string;
  /** A key of manifest.creditCosts */
  creditReason: string;
  replyTo?: string;
  /** Shown on the action-queue card for WhatsApp */
  title?: string;
  ref?: { type: string; id: string };
}

export type SkipReason = "no_consent" | "outside_window" | "frequency_cap" | "opted_out" | "no_credits" | "daily_cap" | "channel_off" | "duplicate" | "kill_switch" | "not_active" | "invalid_recipient";

export type SendOutcome =
  | { status: "sent"; outboxId: string }
  | { status: "queued"; outboxId: string }
  | { status: "dry_run" }
  | { status: "skipped"; reason: SkipReason; retryAt?: string }
  | { status: "failed"; error: string };

export interface ActionItemInput {
  kind: ActionKind;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  ref?: { type: string; id: string };
  idempotencyKey: string;
}

export type LogLevel = "info" | "warn" | "error";

export interface StepCtx {
  agentId: string;
  storeId: string;
  instanceId: string;
  runId: string;
  dryRun: boolean;
  now: Date;
  settings: Record<string, unknown>;
  /** Store identity for messages: the name on invoices, the support email */
  business: { name: string; supportEmail: string | null; country: string };
  /** A stable key for one side effect: agent + store + the parts given */
  idempotencyKey(...parts: (string | number)[]): string;
  db: StoreDb;
  connectors: { get(type: ConnectorType): Promise<Connection | null> };
  llm: { draft(req: DraftRequest): Promise<DraftResult> };
  messages: { send(msg: OutboundMessage): Promise<SendOutcome> };
  actions: { enqueue(item: ActionItemInput): Promise<void> };
  credits: { charge(reason: string, key: string, units?: number): Promise<boolean>; balance(): Promise<number> };
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
}

export type Step<In = unknown, Out = unknown> = (ctx: StepCtx, input: In) => Promise<Out>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StepMap = Record<string, Step<any, any>>;

/** A failure worth retrying later (network, provider down). Anything else fails the run for a person to look at. */
export class RetryableError extends Error {
  constructor(message: string, readonly retryInSeconds = 300) {
    super(message);
  }
}

/** A dashboard number for one store (keys match manifest.metrics); money in paise */
export type MetricValues = Record<string, number>;

export interface WeeklyReport {
  subject: string;
  /** Saved in agent_reports.data and drawn by the agent's email template */
  data: Record<string, unknown>;
  /** Nothing worth sending this week */
  empty: boolean;
}

export interface AgentHooks {
  /** Headline numbers for the dashboard (read-only) */
  metrics?(db: StoreDb, o: { now: Date }): Promise<MetricValues>;
  /** The weekly report's content (read-only); the platform renders, emails and records it */
  report?(db: StoreDb, o: { periodStart: string; periodEnd: string; now: Date }): Promise<WeeklyReport>;
  /** Rows from a connected sheet or an uploaded file, for the agent to save in its own tables */
  ingest?(db: StoreDb, rows: string[][], o: { source: "csv" | "xlsx" | "sheet" | "manual"; fileName: string; mapping?: Record<string, number>; isFull: boolean; now: Date; userId?: string | null; newId: () => string }): Promise<{ ok: boolean; message?: string; summary?: unknown }>;
  /** The owner finished or skipped an action item (e.g. a WhatsApp message sent from the queue) */
  onAction?(db: StoreDb, item: { kind: string; refType: string | null; refId: string | null; payload: Record<string, unknown> }, outcome: "done" | "skipped", now: Date): Promise<void>;
  /** A real message from the store's own data, for "Send me a test email" ({ missing }: nothing to build one from yet) */
  testMessage?(db: StoreDb, o: { settings: Record<string, unknown>; businessName: string; now: Date }): Promise<{ subject: string; body: string; about: string } | { missing: string }>;
}

export interface AgentCode extends AgentHooks {
  manifest: AgentManifest;
  steps: StepMap;
  /** System prompts by name (agents/<id>/prompts) */
  prompts: Record<string, string>;
}

/** Binds an agent's step functions (and prompts) to its manifest: every listed step must exist, and nothing extra */
export function defineSteps(manifest: AgentManifest, steps: StepMap, prompts: Record<string, string> = {}, hooks: AgentHooks = {}): AgentCode {
  const missing = manifest.steps.filter((s) => typeof steps[s] !== "function");
  const extra = Object.keys(steps).filter((s) => !manifest.steps.includes(s));
  if (missing.length) throw new Error(`${manifest.id}: no code for step(s) ${missing.join(", ")}`);
  if (extra.length) throw new Error(`${manifest.id}: step(s) ${extra.join(", ")} aren't in the manifest`);
  return { manifest, steps, prompts, ...hooks };
}
