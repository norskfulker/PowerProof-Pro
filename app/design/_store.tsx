"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { BundleBox } from "@/components/pp/bundle-box";
import { CartDrawer, type CartLine } from "@/components/pp/cart";
import { CheckoutForm } from "@/components/pp/checkout-form";
import { CollectionTile } from "@/components/pp/collection-tile";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { HeroSection } from "@/components/pp/hero-section";
import { HighlightsStrip } from "@/components/pp/highlights-strip";
import { NewsletterForm } from "@/components/pp/newsletter-form";
import { OfferCard } from "@/components/pp/offer-card";
import { OrderBump } from "@/components/pp/order-bump";
import { QuestionThread } from "@/components/pp/question-thread";
import { ReviewForm } from "@/components/pp/review-form";
import { ReviewItem } from "@/components/pp/review-item";
import { ReviewSummary } from "@/components/pp/review-summary";
import { SectionToggleList } from "@/components/pp/section-toggle-list";
import { Stars } from "@/components/pp/stars";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreProductCard } from "@/components/pp/store-product-card";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { ThemePicker } from "@/components/pp/theme-picker";
import { DEFAULT_SECTIONS } from "@/lib/store-themes";
import type { Coupon, Question, Review, SectionSetting, Store, StoreTheme } from "@/lib/types";
import { SAMPLE_PRODUCT } from "./_fixtures";
import { Section, Specimen } from "./_section";

const CARD = { ...SAMPLE_PRODUCT, info: { price: { amount: 104900, currency: "INR" as const }, compareAt: SAMPLE_PRODUCT.price, percentOff: 30, dealEndsAt: new Date(Date.UTC(2030, 0, 1)).toISOString() }, rating: { average: 4.6, count: 38, bars: [1, 1, 2, 9, 25] as [number, number, number, number, number] } };
const COUPON: Coupon = { id: "c", code: "FESTIVE20", kind: "percent", value: 20, used: 3, scope: "store", productIds: [], active: true, expiresAt: "2030-01-01T00:00:00.000Z" };
const REVIEW: Review = { id: "r", productId: "demo", rating: 5, title: "Worth every rupee", body: "Used it the same evening. Saved me hours.", photos: [SAMPLE_PRODUCT.images[0]], author: "Priya S.", createdAt: "2026-09-20T10:00:00.000Z", helpful: 12, verified: true, imported: false, pinned: true, hidden: false, reported: false, reply: { body: "Thank you, this made my day!", createdAt: "2026-09-21T10:00:00.000Z" } };
const QUESTION: Question = { id: "q", productId: "demo", asker: "Neha", askerEmail: "neha@example.com", body: "Does this work on an iPad?", createdAt: "2026-09-20T10:00:00.000Z", answers: [{ id: "a", author: "Ananya", role: "creator", body: "Yes, in any PDF reader.", createdAt: "2026-09-21T10:00:00.000Z" }], hidden: false, reported: false };
const STORE: Store = { id: "s", name: "Ananya Makes", slug: "ananya", tagline: "Notion kits, presets and playbooks.", ownerName: "Ananya Rao", ownerEmail: "a@example.com", brandColor: "#0F3D33", logoText: "AM", currency: "INR", supportEmail: "help@example.com", refundPolicy: "", refundDays: 7, createdAt: "2026-01-01T00:00:00.000Z", onboarded: true };

export function StoreComponents() {
  const [theme, setTheme] = useState<StoreTheme>({ palette: "midnight", fonts: "editorial", heroStyle: "left" });
  const [sections, setSections] = useState<SectionSetting[]>(DEFAULT_SECTIONS.slice(0, 5).map((id) => ({ id, enabled: id !== "offers" })));
  const [bump, setBump] = useState(false);
  const [cart, setCart] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([{ id: "l1", title: "Printed planner", unit: { amount: 49900, currency: "INR" }, qty: 1, image: SAMPLE_PRODUCT.images[0] }]);

  return (
    <>
      <Section id="store" title="Store components" description="Buyer storefront pieces. They read the store's theme from tokens, so one component serves every palette.">
        <div className="flex flex-col gap-4">
          <Specimen label="Theme scope (live)">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <ThemePicker theme={theme} onChange={setTheme} />
              <StoreThemeScope theme={theme} className="overflow-hidden rounded-card border">
                <AnnouncementBar announcement={{ text: "Festive sale: 20% off", code: "FESTIVE20", endsAt: "2030-01-01T00:00:00.000Z" }} />
                <HeroSection hero={{ headline: "Short books. Big shortcuts.", subtext: "Practical ebooks by people who've done the thing.", ctaLabel: "Browse", ctaTarget: "products", imageProductIds: [] }} style={theme.heroStyle} images={SAMPLE_PRODUCT.images} href="#" />
                <div className="py-6"><HighlightsStrip refundDays={7} rating={4.6} reviewCount={38} totalSales={1240} /></div>
              </StoreThemeScope>
            </div>
          </Specimen>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            <StoreProductCard product={CARD} href="#" currency="INR" onBuy={() => toast("Buy now opens checkout")} />
            <CollectionTile collection={{ id: "c", slug: "kits", name: "Notion kits", description: "", productIds: ["a", "b", "c"], cover: { template: "split", title: "Notion kits", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" } }} href="#" />
            <Specimen label="Stars and countdown">
              <Stars value={4.6} size="lg" />
              <CountdownTimer endsAt="2030-01-01T00:00:00.000Z" />
            </Specimen>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <OfferCard coupon={COUPON} />
            <BundleBox name="Starter" products={[SAMPLE_PRODUCT, { ...SAMPLE_PRODUCT, id: "demo-2", title: "Monsoon Moods Presets" }]} full={{ amount: 299800, currency: "INR" }} price={{ amount: 209900, currency: "INR" }} percentOff={30} currency="INR" hrefFor={() => "#"} onBuy={() => toast("Buy bundle")} />
          </div>
        </div>
      </Section>

      <Section id="social" title="Reviews and questions" description="Verified-buyer reviews with creator replies; questions with one level of answers.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReviewSummary summary={CARD.rating} onFilter={() => {}} />
          <div className="rounded-card border bg-surface px-5"><ReviewItem review={REVIEW} creatorName="Ananya" onHelpful={async () => 13} onReport={async () => {}} /></div>
          <Specimen label="ReviewForm"><ReviewForm productTitle="Second Brain" idPrefix="ds-rf" onSubmit={async () => { toast.success("Posted"); }} /></Specimen>
          <div className="rounded-card border bg-surface px-5"><QuestionThread question={QUESTION} onAnswer={async () => {}} onReport={async () => {}} /></div>
          <FaqAccordion items={[{ id: "1", q: "How do I get my files?", a: "Instantly, on screen and by email." }]} />
          <NewsletterForm heading="New drops, first." body="One short email when something lands." onSubscribe={async () => {}} />
        </div>
      </Section>

      <Section id="checkout" title="Checkout pieces" description="Guest checkout: name, email, phone with country code, coupon, payment method, consent.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Specimen label="CheckoutForm"><CheckoutForm international={false} total={{ amount: 149900, currency: "INR" }} termsHref="#" refundHref="#" onPay={() => { toast("Opens the payment sheet"); }} /></Specimen>
          <div className="flex flex-col gap-4">
            <OrderBump label="Add the template pack" description="Same download, one tap." image={SAMPLE_PRODUCT.images[0]} price={{ amount: 19900, currency: "INR" }} checked={bump} onChange={setBump} />
            <Specimen label="Section toggles"><SectionToggleList sections={sections} onChange={setSections} /></Specimen>
            <Specimen label="Cart (physical products only, hidden on digital stores)">
              <Button variant="secondary" className="self-start" onClick={() => setCart(true)}>Open cart drawer</Button>
            </Specimen>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-card border"><StoreFooter store={STORE} socials={{ instagram: "#" }} showPoweredBy /></div>
        <CartDrawer open={cart} onOpenChange={setCart} lines={lines} onQty={(id, qty) => setLines(lines.map((l) => (l.id === id ? { ...l, qty } : l)))} onRemove={(id) => setLines(lines.filter((l) => l.id !== id))} onCheckout={() => toast("Physical checkout comes later")} />
      </Section>
    </>
  );
}
