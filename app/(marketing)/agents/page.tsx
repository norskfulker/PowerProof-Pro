import type { Metadata } from "next";
import { Catalog } from "@/components/agents/catalog";

export const metadata: Metadata = {
  title: "Agents for your business",
  description: "Ready-made agents for Indian small businesses: they chase payments, answer customers and keep track, on their own. Try free.",
};

/** PowerProof Agents: the public catalog (no login) */
export default function AgentsCatalogPage() {
  return (
    <section className="gutter mx-auto max-w-[1200px] pt-10 pb-20 md:pt-16">
      <p className="eyebrow">PowerProof Agents</p>
      <h1 className="mt-2 max-w-3xl text-[2.25rem] sm:text-5xl">Helpers that do the boring follow-ups for you.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">Connect your invoices or sheet once. The agent works every day on its own, and you see everything it does.</p>
      <div className="mt-8">
        <Catalog />
      </div>
    </section>
  );
}
