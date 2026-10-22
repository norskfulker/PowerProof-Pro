import type { Metadata } from "next";
import { StartLink } from "@/components/marketing/start-link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { FeeCalculator } from "@/components/marketing/fee-calculator";
import { ErrorState } from "@/components/pp/empty-state";
import { AI_FREE_MESSAGES, PRO_PRICE_INR, type AllPlanLimits } from "@/lib/plans";
import { fetchPlanLimits } from "@/lib/plan-limits";

export const metadata: Metadata = { title: "Pricing" };
// Limits come from the database; refresh them every few minutes
export const revalidate = 300;

const n = (v: number | null, one: string, many: string) => (v === null ? `Unlimited ${many}` : `${v} ${v === 1 ? one : many}`);

/** Each plan in a few lines: only what differs, plus the fee */
const PLANS = (l: AllPlanLimits) => [
  {
    name: "Free",
    price: "₹0",
    per: "",
    lines: [`${n(l.free.stores, "store", "stores")}, ${n(l.free.products, "product", "products")}, ${n(l.free.pages, "page", "pages")}`, `${n(l.free.teamSeats, "team member", "team members")}`, `${AI_FREE_MESSAGES} AI messages`, "3% per sale"],
    cta: "Start free",
    primary: false,
  },
  {
    name: "Pro",
    price: `₹${PRO_PRICE_INR.toLocaleString("en-IN")}`,
    per: "/ month, first month free",
    lines: ["Unlimited stores, products and pages", `${n(l.pro.teamSeats, "team member", "team members")}`, `${l.pro.aiPagesDaily} AI builds a day, ${l.pro.aiCredits} image credits a month`, "3% per sale"],
    cta: "Start your free month",
    primary: true,
  },
];

const pricingFaq = (l?: AllPlanLimits): [string, string][] => [
  ...(l ? ([["What can I do on Free?", `Everything, for ${l.free.stores ?? "unlimited"} store${l.free.stores === 1 ? "" : "s"} and ${l.free.products ?? "unlimited"} product${l.free.products === 1 ? "" : "s"}, with ${l.free.aiCredits} AI image credits a month. When you want more, Pro removes the limits.`]] as [string, string][]) : []),
  ["Is Pro's first month really free?", "Yes. Add your card to start; the first 30 days aren't charged. The 3% per-sale fee is the same on both plans, so we only earn when you do."],
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
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Free covers one store, up to 10 products and 3 pages. Pro removes the limits for ₹{PRO_PRICE_INR.toLocaleString("en-IN")} a month. Both pay the same 3% per sale.</p>
      </section>

      <section className="gutter mx-auto mt-10 max-w-[1200px]" aria-label="Plans">
        {limits ? (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {PLANS(limits).map((p) => (
              <li key={p.name} className={`flex flex-col rounded-dialog bg-surface p-6 md:p-8 ${p.primary ? "border-2 border-primary" : "border"}`}>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-5xl">{p.price}</span>
                  {p.per && <span className="text-muted-foreground">{p.per}</span>}
                </p>
                <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                  {p.lines.map((i) => (
                    <li key={i} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{i}</li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={p.primary ? "primary" : "secondary"} className="mt-8">
                  <StartLink>{p.cta}</StartLink>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <ErrorState title="The plan details didn't load." message="Refresh the page in a moment." />
        )}
        <p className="mt-4 text-sm text-muted-foreground">Everything else (payouts, invoices, deals, the page editor) is on both plans. The payment gateway adds about 2% per sale.</p>
      </section>

      <section className="gutter mx-auto mt-20 max-w-[1200px]" aria-labelledby="calc-h">
        <h2 id="calc-h" className="mb-4 text-3xl">From sale price to what you keep</h2>
        <FeeCalculator />
      </section>

      <section className="gutter mx-auto mt-24 max-w-[820px]" aria-labelledby="pfaq">
        <h2 id="pfaq" className="mb-6 text-3xl">Money questions</h2>
        <Faq items={limits ? pricingFaq(limits) : pricingFaq(undefined)} />
      </section>

      <CtaBand title="Sell first, pay later." body="Your first month costs nothing but 3% of what you sell." />
    </>
  );
}
