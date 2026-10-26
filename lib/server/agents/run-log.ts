import "server-only";
import type { SayLevel } from "./runtime/types";
import { agentsAdmin } from "./db";

/**
 * The agent's terminal: plain-language lines the owner watches live (agent_run_logs, streamed by
 * Realtime). Writes are kept in order per run and never fail a run: a line that can't be saved is
 * dropped, the work carries on.
 */

export interface RunLog {
  say(level: SayLevel, message: string, step?: string | null): void;
  /** Waits for the lines written so far (call before the run returns) */
  flush(): Promise<void>;
}

export function runLog(o: { storeId: string; instanceId: string; runId: string | null }): RunLog {
  let chain: Promise<void> = Promise.resolve();
  return {
    say(level, message, step = null) {
      const row = { store_id: o.storeId, instance_id: o.instanceId, run_id: o.runId, level, step, message: message.slice(0, 300) || "…" };
      chain = chain.then(async () => {
        try {
          await agentsAdmin().from("agent_run_logs").insert(row);
        } catch {
          /* the terminal is a view; the run doesn't depend on it */
        }
      });
    },
    flush: () => chain,
  };
}
