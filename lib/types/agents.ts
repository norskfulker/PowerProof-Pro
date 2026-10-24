import type { ActionKind, AgentManifest, InstanceStatus } from "../agents/define";

/** PowerProof Agents, as pages see them (rows are mapped in lib/api/live/agents.ts) */

export interface AgentListing {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  status: "live" | "coming_soon";
  /** Switched off by PowerProof for now (live agents only) */
  enabled: boolean;
  /** Live agents: the manifest that drives their page, wizard and dashboard */
  manifest: AgentManifest | null;
  plan: { priceMinor: number; launchPriceMinor: number | null; includedCredits: number } | null;
}

export interface AgentInstance {
  id: string;
  storeId: string;
  agentId: string;
  status: InstanceStatus;
  settings: Record<string, unknown>;
  consentAt: string | null;
  pausedReason: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  trigger: "cron" | "manual" | "dry_run";
  dryRun: boolean;
  status: "running" | "succeeded" | "failed" | "dead";
  summary: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ActionItem {
  id: string;
  instanceId: string;
  kind: ActionKind;
  status: "open" | "done" | "skipped" | "snoozed";
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  refType: string | null;
  refId: string | null;
  createdAt: string;
  snoozeUntil: string | null;
}

export interface AgentConnection {
  id: string;
  type: "verified_email" | "invoice_source" | "google_sheets" | "sms_provider";
  label: string;
  config: Record<string, unknown>;
  status: "connected" | "needs_reauth" | "error";
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  /** Agent instances that use it */
  usedBy: string[];
}

export interface CreditEntry {
  delta: number;
  kind: string;
  reason: string | null;
  createdAt: string;
}

export interface DryRunResult {
  runId: string;
  output: Record<string, unknown>;
  actions: { kind: string; title: string; body: string | null }[];
}

/* Payment Chaser ------------------------------------------------------------------------------- */

export interface ChaserCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  languagePref: "english" | "hinglish" | null;
  isPaused: boolean;
  optedOutAt: string | null;
  notes: string | null;
}

export type ChaserInvoiceStatus = "open" | "paid" | "paused" | "disputed" | "written_off";

export interface ChaserInvoice {
  id: string;
  customerId: string;
  invoiceNo: string;
  invoiceDate: string | null;
  dueDate: string;
  totalMinor: number;
  paidMinor: number;
  status: ChaserInvoiceStatus;
  paidAt: string | null;
  source: string;
}

export type ReminderStatus = "drafted" | "queued" | "approved" | "sent" | "failed" | "skipped" | "snoozed";

export interface ChaserReminder {
  id: string;
  customerId: string;
  invoiceIds: string[];
  stage: number;
  channel: "email" | "whatsapp" | "sms";
  tone: string;
  language: string;
  subject: string | null;
  body: string;
  source: string;
  edited: boolean;
  status: ReminderStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  queuedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface ChaserImport {
  id: string;
  fileName: string;
  source: string;
  rowsTotal: number;
  rowsImported: number;
  rowsUpdated: number;
  rowsFailed: number;
  errorReport: { row: number; reason?: string; warning?: string }[];
  missingInvoiceIds: string[];
  status: "open" | "done";
  createdAt: string;
}

export interface ImportSummary {
  importId: string | null;
  total: number;
  imported: number;
  updated: number;
  failed: number;
  markedPaid: number;
  duplicates?: number;
  missing: { id: string; invoiceNo: string; customer: string; outstandingMinor: number }[];
  problems: { row: number; reason: string }[];
  warnings: { row: number; warning: string }[];
}
