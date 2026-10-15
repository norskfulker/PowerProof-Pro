import Link from "next/link";
import { StartLink } from "@/components/marketing/start-link";
import {
  ArrowRight,
  BadgeIndianRupee,
  Bell,
  FileCheck2,
  FileUp,
  LayoutTemplate,
  Share2,
  Mail,
  ReceiptText,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { GlassIcon } from "@/components/pp/glass-icon";
import { PRO_PRICE_INR } from "@/lib/plans";

const AFTER = [
  { icon: BadgeIndianRupee, title: "Buyer pays", body: "UPI, cards or netbanking." },
  { icon: FileCheck2, title: "File delivered", body: "Download page on screen, link in their inbox. Instantly." },
  { icon: ReceiptText, title: "Invoice sent", body: "GST-ready, numbered, with your HSN/SAC code." },
  { icon: Bell, title: "You hear about it", body: "A sale alert on your phone and a new row on your dashboard." },
  { icon: Zap, title: "Money moves", body: "Held 3 hours, then yours to withdraw any time." },
];

const INDIA = [
  { icon: Smartphone, title: "UPI first", body: "The way India actually pays. Cards and netbanking too." },
  { icon: ReceiptText, title: "Invoices that add up", body: "GSTIN, HSN/SAC, numbering and tax lines handled." },
  { icon: Mail, title: "Receipts that look like you", body: "Your name and logo on every email a buyer gets." },
];

export default function HomePage() {
  return (
    <>
      <div aria-hidden className="grain bg-mesh-dawn pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />
      <section className="gutter relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 pt-10 pb-20 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28">
        <div>
          <h1 className="mt-4 text-[2.75rem] leading-[1.02] sm:text-5xl lg:text-[4rem]">
            Add a product.
            <br />
            Share a link.
            <br />
            <span className="text-primary">Get paid.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            PowerProof builds the store, takes the payment, delivers the file and sends the invoice. You go back to making things.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <StartLink signedIn={<>Go to dashboard <ArrowRight /></>}>
                Start free <ArrowRight />
              </StartLink>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            First month free, then ₹1,999/month. <Link href="/pricing" className="font-medium text-foreground underline underline-offset-4">3% per sale</Link>.
          </p>
        </div>
        <HeroVisual />
      </section>

      <section className="gutter mx-auto max-w-[1200px]" aria-labelledby="ways">
        <h2 id="ways" className="max-w-2xl text-3xl md:text-[2.75rem]">Everything a store needs. Nothing you have to set up.</h2>
        {/* A bento: the three steps, the parts India needs, and the free month */}
        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[minmax(13rem,auto)]">
          <li className="grain bg-mesh-forest flex flex-col justify-between rounded-card p-7 shadow-deep md:col-span-3 md:row-span-2">
            <GlassIcon icon={FileUp} tone="mint" size="xl" />
            <div>
              <p className="text-xs font-semibold tracking-[0.06em] text-white/70 uppercase">Step 1</p>
              <h3 className="mt-2 text-3xl text-white md:text-4xl">Upload a file. Name it. Price it.</h3>
              <p className="mt-3 max-w-md text-white/80">Drop a PDF, ZIP or video, or add something you ship. It&apos;s live in about a minute, with a page that sells it.</p>
            </div>
          </li>
          {[
            { icon: LayoutTemplate, tone: "coral" as const, step: "Step 2", title: "Make the store yours", body: "Pick colours, write your story and arrange the sections. No code." },
            { icon: Share2, tone: "sky" as const, step: "Step 3", title: "Share your link", body: "In your bio, your newsletter, your WhatsApp status." },
          ].map((w) => (
            <li key={w.title} className="flex flex-col justify-between gap-6 rounded-card border bg-surface p-6 shadow-card md:col-span-3">
              <GlassIcon icon={w.icon} tone={w.tone} size="lg" />
              <div>
                <p className="eyebrow">{w.step}</p>
                <h3 className="mt-1.5 text-xl">{w.title}</h3>
                <p className="mt-1 text-muted-foreground">{w.body}</p>
              </div>
            </li>
          ))}
          {INDIA.map((f, i) => (
            <li key={f.title} className="flex flex-col justify-between gap-6 rounded-card border bg-surface p-6 shadow-card md:col-span-2">
              <GlassIcon icon={f.icon} tone={(["amber", "emerald", "lime"] as const)[i]} size="lg" />
              <div>
                <h3 className="text-xl">{f.title}</h3>
                <p className="mt-1 text-muted-foreground">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[1200px]" aria-labelledby="after">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="after" className="mt-3 text-3xl md:text-4xl">What happens when someone buys.</h2>
            <p className="mt-4 text-muted-foreground">
              Nothing you need to do. That&apos;s the point. Every step leaves a receipt, so you, your buyer and your accountant can see what happened.
            </p>
          </div>
          <ol className="relative flex flex-col gap-1 border-l-2 border-dashed border-border-strong pl-6">
            {AFTER.map((a) => (
              <li key={a.title} className="relative py-3">
                <span className="absolute top-3.5 -left-[38px] grid size-7 place-items-center rounded-full border bg-surface text-primary">
                  <a.icon className="size-3.5" aria-hidden />
                </span>
                <p className="font-semibold">{a.title}</p>
                <p className="text-muted-foreground">{a.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>


      <section className="gutter mx-auto mt-24 grid grid-cols-1 max-w-[1200px] items-center gap-10 lg:grid-cols-2" aria-labelledby="money">
        <div>
          <h2 id="money" className="mt-3 text-3xl md:text-4xl">No setup fee. No tiers. No surprises.</h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            First month free. Then ₹{PRO_PRICE_INR.toLocaleString("en-IN")} a month, 3% per sale, and the gateway&apos;s ~2%. That&apos;s the whole list.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/pricing">
              Try the calculator <ArrowRight />
            </Link>
          </Button>
        </div>
        {/* The whole price list, from lib/plans.ts */}
        <dl className="divide-y rounded-card border bg-surface">
          {[
            ["Setting up", "₹0"],
            ["First month", "Free"],
            ["After that", `₹${PRO_PRICE_INR.toLocaleString("en-IN")} a month`],
            ["Per sale", "3%"],
            ["Payment gateway", "~2%, charged by the gateway"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-6 py-4">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-display text-xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[820px]" aria-labelledby="faq">
        <h2 id="faq" className="mb-6 text-3xl md:text-4xl">Questions, answered.</h2>
        <Faq />
      </section>

      <CtaBand />
    </>
  );
}
