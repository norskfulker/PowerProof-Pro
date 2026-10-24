import type { AgentManifest } from "@/lib/agents/define";
import { RetryableError, type StepCtx, type StepMap, type StoreDb } from "./types";

/**
 * The agent loop: Trigger → Read → Think → Act → Log. The platform owns it; an agent supplies its
 * steps. Each step's output is saved as a checkpoint, so a run cut short by the Worker's time limit
 * picks up at the step it was on, and a finished step never runs twice for the same run.
 */

export interface Checkpoints {
  load(): Promise<Record<string, unknown>>;
  done(step: string, output: unknown): Promise<void>;
  failed(step: string, error: string): Promise<void>;
}

export type RunOutcome =
  | { ok: true; output: unknown; ranSteps: string[] }
  | { ok: false; step: string; error: string; retryable: boolean; retryInSeconds?: number; ranSteps: string[] };

export async function runSteps(manifest: AgentManifest, steps: StepMap, ctx: StepCtx, checkpoints: Checkpoints, opts: { deadline?: number } = {}): Promise<RunOutcome> {
  const saved = await checkpoints.load();
  let input: unknown = undefined;
  const ranSteps: string[] = [];
  for (const name of manifest.steps) {
    if (name in saved) {
      input = saved[name];
      continue;
    }
    // Out of time: stop between steps and let the next tick resume from here
    if (opts.deadline && Date.now() > opts.deadline) return { ok: false, step: name, error: "Out of time; resuming on the next run.", retryable: true, retryInSeconds: 0, ranSteps };
    try {
      const output = await steps[name](ctx, input);
      // Checkpoints are JSON; undefined becomes null so the step counts as done
      const stored = output === undefined ? null : output;
      await checkpoints.done(name, stored);
      ranSteps.push(name);
      input = stored;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await checkpoints.failed(name, error.slice(0, 500));
      const retryable = e instanceof RetryableError;
      return { ok: false, step: name, error, retryable, retryInSeconds: retryable ? (e as RetryableError).retryInSeconds : undefined, ranSteps };
    }
  }
  return { ok: true, output: input, ranSteps };
}

/**
 * Narrows the platform context to what the manifest declares: connectors by type, action kinds,
 * credit reasons (the price comes from the manifest, never the step), and tables with the agent's
 * own prefix.
 */
export function guardCtx(manifest: AgentManifest, ctx: StepCtx): StepCtx {
  const connectorTypes = new Set(manifest.connectors.map((c) => c.type));
  const actionKinds = new Set<string>(manifest.actionQueue);
  const ownTable = (t: string) => {
    if (!t.startsWith(manifest.dataPrefix)) throw new Error(`${manifest.id} can't use table ${t}`);
  };
  const db: StoreDb = {
    select: async (t, c, f, o) => (ownTable(t), ctx.db.select(t, c, f, o)),
    insert: async (t, r) => (ownTable(t), ctx.db.insert(t, r)),
    upsert: async (t, r, k, o) => (ownTable(t), ctx.db.upsert(t, r, k, o)),
    update: async (t, p, f) => (ownTable(t), ctx.db.update(t, p, f)),
  };
  return {
    ...ctx,
    db,
    connectors: {
      get: async (type) => {
        if (!connectorTypes.has(type)) throw new Error(`${manifest.id} didn't declare the ${type} connector`);
        return ctx.connectors.get(type);
      },
    },
    actions: {
      enqueue: async (item) => {
        if (!actionKinds.has(item.kind)) throw new Error(`${manifest.id} didn't declare the ${item.kind} action`);
        return ctx.actions.enqueue(item);
      },
    },
    messages: {
      send: async (msg) => {
        if (!(msg.creditReason in manifest.creditCosts)) throw new Error(`${manifest.id} has no credit cost for ${msg.creditReason}`);
        return ctx.messages.send(msg);
      },
    },
    credits: {
      balance: () => ctx.credits.balance(),
      charge: async (reason, key, units = 1) => {
        if (!(reason in manifest.creditCosts)) throw new Error(`${manifest.id} has no credit cost for ${reason}`);
        return ctx.credits.charge(reason, key, units);
      },
    },
  };
}
