"use client";

import type { ComponentType } from "react";
import type { AgentInstance } from "@/lib/types/agents";
import { chaserUi } from "./payment-chaser/ui";

/**
 * Screens an agent adds to the platform's pages, by agent id (like agents/index.ts, one line per
 * agent). Everything else (wizard steps, settings, activity, credits, help) is drawn from the
 * manifest. An agent with no entry here still works with the generic screens.
 */
export interface AgentUi {
  /** Wizard step 1: bring in the agent's data (upload, sheet, manual) */
  DataStep?: ComponentType<{ instance: AgentInstance; onReady: (ready: boolean) => void }>;
  /** Shown above the dry-run messages in the wizard: the free preview's numbers */
  PreviewSummary?: ComponentType<{ instance: AgentInstance }>;
  /** The agent's Overview tab */
  Overview?: ComponentType<{ instance: AgentInstance }>;
  /** Extra screens at /agents/my/<instance>/<view>/… */
  views?: Record<string, ComponentType<{ instance: AgentInstance; path: string[] }>>;
  /** Links to those screens, for the agent's page */
  links?: { view: string; label: string }[];
}

export const AGENT_UI: Record<string, AgentUi> = {
  "payment-chaser": chaserUi,
};
