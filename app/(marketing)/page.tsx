import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  Bell,
  FileCheck2,
  FileUp,
  Globe2,
  LayoutTemplate,
  Link2,
  Mail,
  ReceiptText,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { FeeBreakdown } from "@/components/pp/fee-breakdown";

const WAYS = [
  { icon: Link2, title: "Paste a link", body: "Selling on Gumroad or Instamojo already? Paste the link. We pull in the title, price, description and images." },
  { icon: FileUp, title: "Upload a file", body: "Drop a PDF, ZIP or anything up to 2 GB. Name it, price it, done." },
  { icon: LayoutTemplate, title: "Build a page", body: "Pick a template or paste your own HTML. Buy buttons wire themselves." },
];

const AFTER = [
  { icon: BadgeIndianRupee, title: "Buyer pays", body: "UPI, cards or netbanking. In their own currency." },
  { icon: FileCheck2, title: "File delivered", body: "Download page on screen, link in their inbox. Instantly." },
  { icon: ReceiptText, title: "Invoice sent", body: "GST-ready, numbered, with your HSN/SAC code." },
  { icon: Bell, title: "You hear about it", body: "A sale alert on your phone and a new row on your dashboard." },
  { icon: Zap, title: "Money moves", body: "Available to withdraw two days later." },
];

const INDIA = [
  { icon: Smartphone, title: "UPI first", body: "The way India actually pays. Cards and netbanking too." },
  { icon: Globe2, title: "Priced for every buyer", body: "Visitors see local prices. You get rupees in your bank." },
  { icon: ReceiptText, title: "Invoices that add up", body: "GSTIN, HSN/SAC, numbering and tax lines handled." },
  { icon: Mail, title: "Receipts that look like you", body: "Your name and logo on every email a buyer gets." },
];

export default function HomePage() {
  return (
    <>
      <section className="gutter mx-auto grid grid-cols-1 max-w-[1200px] items-center gap-14 pt-10 pb-16 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div>
          <p className="eyebrow">For creators selling digital products</p>
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
              <Link href="/signup">
                Start free <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/s/ananya">See a live store</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            First month free, then $20/month. <Link href="/pricing" className="font-medium text-foreground underline underline-offset-4">3% per sale</Link>.
          </p>
        </div>
        <div className="py-6">
          <HeroVisual />
        </div>
      </section>

      <section className="gutter mx-auto max-w-[1200px]" aria-labelledby="ways">
        <p className="eyebrow">Step one is the only step</p>
        <h2 id="ways" className="mt-3 max-w-xl text-3xl md:text-4xl">Three ways to put something up for sale.</h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {WAYS.map((w, i) => (
            <li key={w.title} className="rounded-card border bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary">
                  <w.icon className="size-5" aria-hidden />
                </span>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl">{w.title}</h3>
              <p className="mt-2 text-muted-foreground">{w.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="gutter mx-auto mt-24 max-w-[1200px]" aria-labelledby="after">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">Then it runs itself</p>
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

      <section className="gutter mx-auto mt-24 max-w-[1200px]" aria-labelledby="india">
        <p className="eyebrow">Made in India, sold everywhere</p>
        <h2 id="india" className="mt-3 max-w-2xl text-3xl md:text-4xl">The boring parts, already done properly.</h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INDIA.map((f) => (
            <li key={f.title} className="rounded-card border bg-surface p-6">
              <f.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-sans text-lg font-semibold tracking-normal">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="gutter mx-auto mt-24 grid grid-cols-1 max-w-[1200px] items-center gap-10 lg:grid-cols-2" aria-labelledby="money">
        <div>
          <p className="eyebrow">Pricing, in one breath</p>
          <h2 id="money" className="mt-3 text-3xl md:text-4xl">No setup fee. No tiers. No surprises.</h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            First month free. Then $20 a month, 3% per sale, and the gateway&apos;s ~2%. That&apos;s the whole list.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/pricing">
              Try the calculator <ArrowRight />
            </Link>
          </Button>
        </div>
        <FeeBreakdown sale={{ amount: 99900, currency: "INR" }} title="On a ₹999 sale" />
      </section>

      <section className="gutter mx-auto mt-24 max-w-[820px]" aria-labelledby="faq">
        <h2 id="faq" className="mb-6 text-3xl md:text-4xl">Questions, answered.</h2>
        <Faq />
      </section>

      <CtaBand />
    </>
  );
}
