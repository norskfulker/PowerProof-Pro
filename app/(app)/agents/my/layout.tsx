import type { Metadata } from "next";
import { AgentsGate } from "@/components/agents/bits";

export const metadata: Metadata = { title: { default: "Agents", template: "%s · Agents · PowerProof" } };

/** The signed-in agents area: inside the app shell (store required), for the store's owner and admins */
export default function MyAgentsLayout({ children }: { children: React.ReactNode }) {
  return <AgentsGate>{children}</AgentsGate>;
}
