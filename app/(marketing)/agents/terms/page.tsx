import type { Metadata } from "next";

export const metadata: Metadata = { title: "Agents: terms and privacy (draft)", robots: { index: false } };

/**
 * PLACEHOLDER. A lawyer must review this and the messaging rules (India's DPDP Act, telecom
 * messaging rules) before real customers use agents. Tracked in docs/agents/DECISIONS-AGENTS.md.
 */
export default function AgentTermsPage() {
  return (
    <section className="gutter mx-auto max-w-[760px] pt-10 pb-20">
      <p className="rounded-control border border-warning/50 bg-warning-soft p-3 text-sm font-semibold">Draft, not yet reviewed by a lawyer. Not in force.</p>
      <h1 className="mt-6 text-4xl">Agents: terms and privacy</h1>
      <div className="mt-6 flex flex-col gap-4 text-muted-foreground">
        <p>This page will set out how PowerProof Agents work for your business and for the people they contact on your behalf.</p>
        <h2 className="text-xl text-foreground">What it will cover</h2>
        <ul className="list-disc pl-5">
          <li>Your promise that the people you upload owe you money and that you may contact them.</li>
          <li>What data agents keep (names, contact details, invoices, messages), why, and for how long.</li>
          <li>How customers opt out, and that they are never contacted again after they do.</li>
          <li>How credits, trials and plans work, and that nothing is charged without you.</li>
          <li>Exporting and deleting your data.</li>
        </ul>
      </div>
    </section>
  );
}
