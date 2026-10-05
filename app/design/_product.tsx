"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard, RevenueBars, ShareBars, VisitorsArea } from "@/components/pp/chart-card";
import { CopyField } from "@/components/pp/copy-field";
import { CurrencyInput } from "@/components/pp/currency-input";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { FeeBreakdown } from "@/components/pp/fee-breakdown";
import { HtmlPasteEditor } from "@/components/pp/html-paste-editor";
import { Logo } from "@/components/pp/logo";
import { MoneyText } from "@/components/pp/money-text";
import { PayoutMethodCard } from "@/components/pp/payout-method-card";
import { ProductCard } from "@/components/pp/product-card";
import { ProofReceipt } from "@/components/pp/proof-receipt";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { StepProgress } from "@/components/pp/step-progress";
import { TemplateCard } from "@/components/pp/template-card";
import { TEMPLATES } from "@/lib/templates";
import type { Money, Order } from "@/lib/types";
import { SAMPLE_METHODS, SAMPLE_ORDER, SAMPLE_PRODUCT, SAMPLE_SERIES } from "./_fixtures";
import { Section, Specimen } from "./_section";

const COLS: ColumnDef<Order, unknown>[] = [
  { accessorKey: "number", header: "Order", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as string}</span> },
  { accessorKey: "buyerName", header: "Buyer" },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
  { id: "total", header: "Total", meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.buyerTotal} mono /> },
];

export function ProductComponents() {
  const [price, setPrice] = useState<Money | undefined>({ amount: 49900, currency: "INR" });
  const [html, setHtml] = useState(`<h1 style="font-family:system-ui;padding:16px">Hello</h1>\n<button data-pp-buy="demo">Buy</button>`);
  const [step, setStep] = useState(2);
  const [tpl, setTpl] = useState("launch");
  const [method, setMethod] = useState("b");

  return (
    <>
      <Section id="brand" title="Logo">
        <div className="flex flex-wrap items-center gap-6">
          <Logo href={null} />
          <span className="rounded-card bg-primary p-4"><Logo href={null} inverted /></span>
          <Logo href={null} compact />
        </div>
      </Section>

      <Section id="numbers" title="Numbers and money" description="Money is integer minor units + currency. MoneyText formats all of it: symbol, two decimals, Indian grouping for rupees.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue today" value={<MoneyText value={{ amount: 485000, currency: "INR" }} />} delta={18.2} hint="vs yesterday" emphasis />
          <StatCard label="Sales" value="6" delta={-4.1} hint="vs yesterday" />
          <StatCard label="Visitors" loading />
          <Specimen label="MoneyText">
            <MoneyText value={{ amount: 15240050, currency: "INR" }} />
            <MoneyText value={{ amount: 1799, currency: "USD" }} />
            <MoneyText value={{ amount: 6599, currency: "AED" }} mono />
            <MoneyText value={{ amount: -4497, currency: "INR" }} mono />
            <MoneyText value={{ amount: 15240050, currency: "INR" }} compact />
          </Specimen>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Specimen label="CurrencyInput">
            <label htmlFor="d-price" className="text-sm font-medium">Price</label>
            <CurrencyInput id="d-price" value={price} onChange={setPrice} />
            <label htmlFor="d-price-err" className="text-sm font-medium">Price (error state)</label>
            <CurrencyInput id="d-price-err" value={undefined} onChange={() => {}} invalid aria-describedby="d-pe" />
            <p id="d-pe" className="text-sm font-medium text-danger">Set a price of at least ₹10.00.</p>
          </Specimen>
          <FeeBreakdown sale={price ?? { amount: 0, currency: "INR" }} />
        </div>
        <div className="mt-4">
          <Specimen label="CopyField">
            <CopyField label="Store link" value="https://powerproof.store/ananya" display="powerproof.store/ananya" />
            <CopyField label="Embed code" value={`<script src="https://powerproof.store/embed.js" data-product="demo"></script>`} multiline toastText="Embed code copied" />
          </Specimen>
        </div>
      </Section>

      <Section id="states" title="Empty, error, loading" description="Every list and screen has all four states. Voice: short, plain, a little witty.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EmptyState icon={Package} title="Nothing sold yet." body="Your first sale will show up here." action={<Button>Share your store</Button>} />
          <ErrorState message="We couldn't reach PowerProof. Check your connection and try again." onRetry={() => {}} />
        </div>
      </Section>

      <Section id="cards" title="Product, receipt, payout">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ProductCard product={SAMPLE_PRODUCT} href="#" />
          <ProductCard product={SAMPLE_PRODUCT} href="#" variant="buyer" currency="USD" />
          <ProofReceipt order={SAMPLE_ORDER} storeName="Ananya Makes" showFees />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {SAMPLE_METHODS.map((m) => (
            <PayoutMethodCard key={m.id} method={m} selected={method === m.id} onSelect={() => setMethod(m.id)} />
          ))}
        </div>
      </Section>

      <Section id="steps" title="Step progress">
        <Specimen label="Onboarding">
          <StepProgress steps={["Store", "Business", "Payouts", "Product", "Publish"]} current={step} />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
            <Button size="sm" onClick={() => setStep((s) => Math.min(4, s + 1))}>Next</Button>
          </div>
        </Specimen>
      </Section>

      <Section id="templates" title="Template cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.slice(0, 3).map((t) => (
            <TemplateCard key={t.id} template={t} selected={tpl === t.id} onSelect={() => setTpl(t.id)} />
          ))}
        </div>
      </Section>

      <Section id="charts" title="Charts" description="Recharts with brand colours. Emerald for money, brass for traffic.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Revenue" description="Last 7 days"><RevenueBars data={SAMPLE_SERIES} /></ChartCard>
          <ChartCard title="Visitors" description="Last 7 days"><VisitorsArea data={SAMPLE_SERIES} /></ChartCard>
          <ChartCard title="Sources" height={160}>
            <ShareBars rows={[{ label: "instagram", value: 1840, share: 46 }, { label: "direct", value: 960, share: 24 }, { label: "google", value: 720, share: 18 }]} />
          </ChartCard>
          <div className="grid gap-4">
            <ChartCard title="Loading" loading height={80} />
            <ChartCard title="Empty" empty height={80} />
            <ChartCard title="Error" error="Couldn't load chart." onRetry={() => {}} height={80} />
          </div>
        </div>
      </Section>

      <Section id="table" title="Data table" description="TanStack table: search, filters, sorting, pagination, skeleton rows, and cards on phones.">
        <DataTable
          label="Example orders"
          columns={COLS}
          data={Array.from({ length: 14 }, (_, i) => ({ ...SAMPLE_ORDER, id: `o${i}`, number: `PP-${1081 - i}`, status: (["paid", "refunded", "pending", "refund_requested"] as const)[i % 4] }))}
          filters={[{ columnId: "status", label: "Statuses", options: [{ value: "paid", label: "Paid" }, { value: "refunded", label: "Refunded" }] }]}
          searchPlaceholder="Search orders"
          pageSize={5}
        />
      </Section>

      <Section id="editors" title="Editors" description="HtmlPasteEditor wires any data-pp-buy button. The image maker lives at /images.">
        <HtmlPasteEditor value={html} onChange={setHtml} productNames={{ demo: "Second Brain for Founders" }} />
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/images">Open the image maker</Link>
        </Button>
      </Section>
    </>
  );
}
