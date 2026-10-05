import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { FeeCalculator } from "@/components/marketing/fee-calculator";

export const metadata: Metadata = { title: "Pricing" };

const INCLUDED = [
  "Unlimited products and pages",
  "Instant delivery and download links",
  "GST-ready invoices with HSN/SAC",
  "Buyers pay in their own currency",
  "Payouts to your bank, two days after each sale",
  "Google Analytics and Microsoft Clarity",
  "Product image maker and page templates",
  "Team seats for support and design help",
];

const PRICING_FAQ: [string, string][] = [
  ["Is the first month really free?", "Yes. No card to start. The 3% per-sale fee still applies, so we only earn when you do."],
  ["What's the ~2% gateway fee?", "The payment gateway charges it to move money. It's about 2% for Indian cards and UPI and can be a little higher for international cards."],
  ["Do you charge GST on fees?", "Fees are shown before GST. If GST applies to your account, it appears on your monthly PowerProof invoice."],
  ["Can I cancel?", "Any time, from Settings. Your store stays up until the end of the month you paid for."],
];

export default function PricingPage() {
  return (
    <>
      <section className="gutter mx-auto max-w-[1200px] pt-12 md:pt-16">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-3 max-w-3xl text-[2.5rem] sm:text-5xl">One plan. You&apos;ll know what you keep before you sell.</h1>
      </section>

      <section className="gutter mx-auto mt-10 grid grid-cols-1 max-w-[1200px] gap-6 lg:grid-cols-[380px_minmax(0,1fr)]" aria-label="Plan">
        <div className="flex flex-col rounded-dialog border-2 border-primary bg-surface p-6 md:p-8">
          <div className="flex items-center justify-between">
            <p className="font-semibold">PowerProof</p>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">First month free</span>
          </div>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl">$20</span>
            <span className="text-muted-foreground">/ month</span>
          </p>
          <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-3 border-y py-5 text-sm">
            <dt>Per sale</dt>
            <dd className="font-mono font-semibold">3%</dd>
            <dt>Payment gateway</dt>
            <dd className="font-mono font-semibold">~2%</dd>
            <dt>Setup, listing, payout fees</dt>
            <dd className="font-mono font-semibold">₹0.00</dd>
          </dl>
          <ul className="mt-6 flex flex-col gap-2.5 text-sm">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {i}
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-8">
            <Link href="/signup">Start your free month</Link>
          </Button>
        </div>
        <div>
          <h2 className="mb-4 text-2xl">From sale price to what you keep</h2>
          <FeeCalculator />
        </div>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[820px]" aria-labelledby="pfaq">
        <h2 id="pfaq" className="mb-6 text-3xl">Money questions</h2>
        <Faq items={PRICING_FAQ} />
      </section>

      <CtaBand title="Sell first, pay later." body="Your first month costs nothing but 3% of what you sell." />
    </>
  );
}
