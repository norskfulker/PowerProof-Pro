import { DEFAULT_SECTIONS } from "../store-themes";
import type { InvoiceSettings, Store, StoreDesign, StorePages } from "../types";

/**
 * What a brand-new store starts with: policy wording, the page layout and invoice defaults.
 * This is starter copy the creator edits, not made-up content: it contains no names, prices,
 * offers or links.
 */

export function defaultPages(store: Pick<Store, "name" | "refundDays" | "supportEmail"> & Partial<Pick<Store, "sells">>): StorePages {
  return {
    faq: defaultFaq(store),
    refund: `If a file doesn't open, or the product isn't what the page described, write to ${store.supportEmail} within ${store.refundDays} days of buying. We'll fix it or refund you in full. Refunds go back to the original payment method in 5 to 7 working days, and the download link stops working once a refund is made.`,
    terms: `When you buy from ${store.name} you get a personal licence to use the files for yourself or your own projects. You can't resell, share or redistribute them. Prices include any GST that applies. Payments are handled by a licensed payment gateway through PowerProof.`,
    privacy: `${store.name} uses your name, email and phone only to deliver your order, send your receipt and answer your questions. Payment details go straight to the payment gateway and are never stored by us. We don't sell your data. Ask ${store.supportEmail} to see or delete what we hold.`,
    contactNote: "We reply within one working day, usually faster.",
  };
}

/**
 * The questions every store answers, until the creator writes their own (or if they clear them
 * all): for downloads or for things that ship, depending on what the store sells.
 */
export function defaultFaq(store: Pick<Store, "refundDays"> & Partial<Pick<Store, "sells">>): StorePages["faq"] {
  const refund = { id: "f-refund", q: "What if it isn't right for me?", a: `Write within ${store.refundDays} days and we'll sort it out, usually with a refund.` };
  const invoice = { id: "f-invoice", q: "Do I get an invoice?", a: "Every order comes with an invoice. Open it from your order page." };
  const pay = { id: "f-pay", q: "How can I pay?", a: "UPI, cards and netbanking. From outside India you'll see prices in your currency and can pay by card." };
  if (store.sells === "physical" || store.sells === "both") {
    return [
      { id: "f-ship", q: "When will my order arrive?", a: "We pack and send it as soon as we can. You'll get an email when it's on its way, with tracking when there is any." },
      { id: "f-track", q: "How do I check my order?", a: "Use the link in your order email, or Find my order at the bottom of this page. No account needed." },
      pay,
      refund,
      invoice,
    ];
  }
  return [
    { id: "f1", q: "How do I get my files?", a: "Right after paying you land on a download page, and the same link is emailed to you. No account needed." },
    pay,
    { id: "f3", q: "Do I get updates?", a: "Yes. When a product is updated, your download link gets the new version." },
    refund,
    invoice,
  ];
}

/** The look a new store starts with: product list, FAQ and newsletter. Header/footer are global store chrome. */
export function defaultDesign(store: Pick<Store, "name" | "tagline" | "ownerName">): StoreDesign {
  const first = store.ownerName.trim().split(" ")[0];
  return {
    // The global store header and footer are rendered separately from page sections.
    sections: DEFAULT_SECTIONS.map((id) => ({ id, enabled: true })),
    theme: { palette: "emerald", fonts: "modern", heroStyle: "left", mode: "auto" },
    hero: { headline: store.name, subtext: store.tagline, ctaLabel: "Shop now", ctaTarget: "products", imageProductIds: [] },
    announcement: { text: "" },
    about: { name: store.ownerName, initials: store.ownerName.split(" ").map((w) => w[0]).join("").slice(0, 2), story: first ? `Hi, I'm ${first}. I make digital products and I'm glad you're here.` : "", location: "" },
    socials: { instagram: "", youtube: "", x: "", website: "" },
    seo: { title: store.name, description: store.tagline },
    newsletter: { heading: "New drops, first.", body: "One short email when something new lands. No spam, unsubscribe any time." },
    showPoweredBy: true,
  };
}

export const defaultInvoiceSettings: InvoiceSettings = { prefix: "INV", footerNote: "Thank you for your purchase." };
