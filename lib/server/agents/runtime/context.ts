import type { AgentManifest, InstanceStatus } from "@/lib/agents/define";
import { draftWith, type GatewayDeps } from "../llm/gateway";
import { sendThroughPipeline, type PipelineDeps } from "../messaging/pipeline";
import { guardCtx } from "./engine";
import type { ActionItemInput, AgentCode, Connection, LogLevel, StepCtx, StoreDb } from "./types";

/**
 * Builds a step context from platform ports. Production passes Supabase-backed ports
 * (lib/server/agents/ports.ts); tests pass in-memory ones. A dry run sends nothing, charges nothing
 * and queues nothing: the pipeline answers "dry_run" and actions are collected for the preview.
 */

export interface InstanceInfo {
  id: string;
  storeId: string;
  status: InstanceStatus;
  settings: Record<string, unknown>;
  consentAt: string | null;
}

export interface Ports {
  db: StoreDb;
  connection(type: Connection["type"]): Promise<Connection | null>;
  llm: Omit<GatewayDeps, "systemPrompt" | "forbidden">;
  messaging: Omit<PipelineDeps, "now" | "dryRun" | "instance" | "limits" | "creditCost">;
  enqueueAction(item: ActionItemInput): Promise<void>;
  credits: { charge(n: number, reason: string, key: string): Promise<boolean>; balance(): Promise<number> };
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
}

export interface CtxInput {
  code: AgentCode;
  instance: InstanceInfo;
  runId: string;
  dryRun: boolean;
  now: Date;
  business: StepCtx["business"];
  ports: Ports;
  /** Collects what a dry run would have queued */
  preview?: ActionItemInput[];
}

export function sendWindowOf(manifest: AgentManifest, settings: Record<string, unknown>): string {
  return typeof settings.send_window === "string" ? settings.send_window : manifest.guardrails.sendWindow;
}

export function channelsOf(settings: Record<string, unknown>): ("email" | "sms" | "whatsapp")[] {
  return Array.isArray(settings.channels) ? (settings.channels.filter((c) => c === "email" || c === "sms" || c === "whatsapp") as ("email" | "sms" | "whatsapp")[]) : ["email"];
}

export function makeCtx(o: CtxInput): StepCtx {
  const { manifest, prompts } = o.code;
  const p = o.ports;
  const dailyCap = Number(o.instance.settings.daily_cap) || manifest.guardrails.dailySendCap;
  const ctx: StepCtx = {
    agentId: manifest.id,
    storeId: o.instance.storeId,
    instanceId: o.instance.id,
    runId: o.runId,
    dryRun: o.dryRun,
    now: o.now,
    settings: o.instance.settings,
    business: o.business,
    idempotencyKey: (...parts) => [manifest.id, o.instance.storeId, ...parts].join(":"),
    db: p.db,
    connectors: { get: (type) => p.connection(type) },
    llm: {
      draft: (req) =>
        draftWith(
          {
            ...p.llm,
            systemPrompt: (name) => {
              const s = prompts[name];
              if (!s) throw new Error(`${manifest.id} has no prompt called ${name}`);
              return s;
            },
            forbidden: manifest.guardrails.forbiddenPhrases,
          },
          req
        ),
    },
    messages: {
      send: (msg) =>
        sendThroughPipeline(
          {
            ...p.messaging,
            now: o.now,
            dryRun: o.dryRun,
            instance: { status: o.instance.status, consentAt: o.instance.consentAt, sendWindow: sendWindowOf(manifest, o.instance.settings), channelsOn: channelsOf(o.instance.settings) },
            limits: { capMessages: manifest.guardrails.maxMessagesPerContactPerDays.messages, capDays: manifest.guardrails.maxMessagesPerContactPerDays.days, dailyCap },
            creditCost: (reason) => manifest.creditCosts[reason] ?? 0,
          },
          msg,
          o.business.name
        ),
    },
    actions: {
      enqueue: async (item) => {
        if (o.dryRun) {
          o.preview?.push(item);
          return;
        }
        await p.enqueueAction(item);
      },
    },
    credits: {
      balance: () => p.credits.balance(),
      charge: async (reason, key, units = 1) => {
        const n = (manifest.creditCosts[reason] ?? 0) * units;
        if (o.dryRun || n === 0) return true;
        return p.credits.charge(n, reason, key);
      },
    },
    log: (level, message, data) => p.log(level, message, { agent: manifest.id, run: o.runId, ...data }),
  };
  return guardCtx(manifest, ctx);
}
