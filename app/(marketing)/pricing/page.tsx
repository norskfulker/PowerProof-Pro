import type { Metadata } from "next";
import { StartLink } from "@/components/marketing/start-link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { FeeCalculator } from "@/components/marketing/fee-calculator";
import { PlanComparisonTable } from "@/components/plan/plan-usage";
import { ErrorState } from "@/components/pp/empty-state";
import { PRO_PRICE_USD, type AllPlanLimits } from "@/lib/plans";
import { fetchPlanLimits } from "@/lib/plan-limits";

export const metadata: Metadata = { title: "Pricing" };
// Limits come from the database; refresh them every few minutes
export const revalidate = 300;

const included = (l: AllPlanLimits) => [
  "Unlimited stores and products",
  `${l.pro.aiCredits} AI image credits a month`,
  "Instant delivery and download links",
  "GST-ready invoices with HSN/SAC",
  "Payouts to your bank: each sale is held 3 hours, then yours to withdraw any time",
  "Page templates and the visual page editor",
];

const pricingFaq = (l?: AllPlanLimits): [string, string][] => [
  ...(l ? ([["What can I do on Free?", `Everything, for ${l.free.stores ?? "unlimited"} store${l.free.stores === 1 ? "" : "s"} and ${l.free.products ?? "unlimited"} product${l.free.products === 1 ? "" : "s"}, with ${l.free.aiCredits} AI image credits a month. When you want more, Pro removes the limits.`]] as [string, string][]) : []),
  ["Is Pro's first month really free?", "Yes. No card to start. The 3% per-sale fee is the same on both plans, so we only earn when you do."],
  ["What's the ~2% gateway fee?", "The payment gateway charges it to move money. It's about 2% for Indian cards and UPI and can be a little higher for international cards."],
  ["Do you charge GST on fees?", "Fees are shown before GST. If GST applies to your account, it appears on your monthly PowerProof invoice."],
  ["Can I cancel?", "Any time, from Settings. Your store stays up until the end of the month you paid for."],
];

/** The plan table comes from the database. If it can't be read, say so: never fill it in from memory. */
async function loadLimits(): Promise<AllPlanLimits | undefined> {
  try {
    return await fetchPlanLimits();
  } catch {
    return undefined;
  }
}

export default async function PricingPage() {
  const limits = await loadLimits();
  return (
    <>
      <section className="gutter mx-auto max-w-[1200px] pt-12 md:pt-16">
        <h1 className="mt-3 max-w-3xl text-[2.5rem] sm:text-5xl">Start free. You&apos;ll know what you keep before you sell.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Free covers one store, up to 10 products and 3 pages. Pro removes the limits for ${PRO_PRICE_USD} a month. Both pay the same 3% per sale.</p>
      </section>

      <section className="gutter mx-auto mt-10 grid grid-cols-1 max-w-[1200px] gap-6 lg:grid-cols-[380px_minmax(0,1fr)]" aria-label="Plan">
        <div className="flex flex-col rounded-dialog border-2 border-primary bg-surface p-6 md:p-8">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Pro</p>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">First month free</span>
          </div>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl">${PRO_PRICE_USD}</span>
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
            {(limits ? included(limits) : []).map((i) => (
              <li key={i} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {i}
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-8">
            <StartLink>Start your free month</StartLink>
          </Button>
        </div>
        <div>
          <h2 className="mb-4 text-2xl">From sale price to what you keep</h2>
          <FeeCalculator />
        </div>
      </section>

      <section className="gutter mx-auto mt-20 max-w-[1200px]" aria-labelledby="compare-h">
        <h2 id="compare-h" className="mb-2 text-3xl">Free and Pro, side by side</h2>
        <p className="mb-6 text-muted-foreground">On Free, you&apos;ll see an upgrade option when you reach a limit. Nothing stops working.</p>
        {limits ? (
          <div className="overflow-x-auto rounded-card border bg-surface">
            <PlanComparisonTable limits={limits} />
          </div>
        ) : (
          <ErrorState title="The plan details didn't load." message="Refresh the page in a moment." />
        )}
        <Button asChild variant="secondary" className="mt-6">
          <StartLink>Start on Free</StartLink>
        </Button>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[820px]" aria-labelledby="pfaq">
        <h2 id="pfaq" className="mb-6 text-3xl">Money questions</h2>
        <Faq items={limits ? pricingFaq(limits) : pricingFaq(undefined)} />
      </section>

      <CtaBand title="Sell first, pay later." body="Your first month costs nothing but 3% of what you sell." />
    </>
  );
}
