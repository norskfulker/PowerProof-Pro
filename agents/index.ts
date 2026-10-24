import type { AgentManifest } from "@/lib/agents/define";
import paymentChaser from "./payment-chaser/manifest";

/**
 * Every agent PowerProof runs, listed by hand (Workers have no filesystem to scan). Adding an agent
 * is its folder plus one line here and one in `agents/server.ts`. Manifests only: this file is safe
 * to import from pages. Coming-soon agents are rows in agent_catalog (added from Admin), not code.
 */
export const AGENTS: readonly AgentManifest[] = [paymentChaser];

export function getManifest(id: string, registry: readonly AgentManifest[] = AGENTS): AgentManifest | undefined {
  return registry.find((a) => a.id === id);
}
