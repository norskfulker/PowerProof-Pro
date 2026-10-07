import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    n: "01",
    time: "30 seconds",
    title: "Name your store",
    body: "Pick a name and a link like powerproof.store/yourname. Business details are optional; add them when you need GST invoices.",
  },
  {
    n: "02",
    time: "1 minute",
    title: "Tell us where to send money",
    body: "Add a bank account. We verify it with a ₹1 test deposit, so your first payout doesn't bounce.",
  },
  {
    n: "03",
    time: "1 minute",
    title: "Add your first product",
    body: "Upload the file buyers get, name it and set a price in rupees.",
  },
  {
    n: "04",
    time: "1 tap",
    title: "Publish and share",
    body: "Your store goes live. Put the link in your bio, your newsletter, your WhatsApp status. Wherever your people are.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="gutter mx-auto max-w-[1200px] pt-12 md:pt-16">
        <p className="eyebrow">How it works</p>
        <h1 className="mt-3 max-w-3xl text-[2.5rem] sm:text-5xl">From nothing to a working store in under three minutes.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">Four steps for you. Everything after that is our job.</p>
      </section>

      <section className="gutter mx-auto mt-12 max-w-[1200px]" aria-label="Setup steps">
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col rounded-card border bg-surface p-6 md:p-8">
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl text-accent-strong">{s.n}</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden /> {s.time}
                </span>
              </div>
              <h2 className="mt-6 text-2xl">{s.title}</h2>
              <p className="mt-2 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[1200px]" aria-labelledby="buyer">
        <div>
          <p className="eyebrow">The buyer&apos;s side</p>
          <h2 id="buyer" className="mt-3 text-3xl md:text-4xl">They pay, they download, they get a proof.</h2>
          <ul className="mt-6 flex flex-col gap-4 text-muted-foreground">
            <li><strong className="text-foreground">No account.</strong> Email and payment, nothing else.</li>
            <li><strong className="text-foreground">Instant file.</strong> The download page opens the moment payment clears. The link is emailed too.</li>
            <li><strong className="text-foreground">A real receipt.</strong> Order number, invoice, refund link. Fewer “did it go through?” DMs.</li>
          </ul>
        </div>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[1200px]" aria-labelledby="money-flow">
        <p className="eyebrow">Where the money goes</p>
        <h2 id="money-flow" className="mt-3 max-w-2xl text-3xl md:text-4xl">Held for 3 hours, then yours to withdraw any time.</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ["Day 0", "Sale", "Shows on your dashboard as pending, with the fee split."],
            ["Day 2", "Available", "Moves to your available balance. Refund window is still open for the buyer."],
            ["Any day", "Withdraw", "Send any amount above ₹100 to your bank. Usually lands within hours."],
          ].map(([d, t, b]) => (
            <div key={d} className="rounded-card border bg-surface p-6">
              <p className="eyebrow">{d}</p>
              <p className="mt-2 font-display text-2xl">{t}</p>
              <p className="mt-2 text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
