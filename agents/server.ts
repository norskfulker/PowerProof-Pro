import type { AgentCode } from "@/lib/server/agents/runtime/types";
import paymentChaser from "./payment-chaser/steps";

/**
 * The step code and prompts for every agent in `agents/index.ts`, keyed by agent id. Server only in
 * practice (steps reach the database through the run context), kept free of `server-only` so tests
 * can load it.
 */
export const AGENT_CODE: Record<string, AgentCode> = {
  [paymentChaser.manifest.id]: paymentChaser,
};
