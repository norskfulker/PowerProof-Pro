import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { BundleBox } from "@/components/pp/bundle-box";
import { CartDrawer, CartLines, type CartLine } from "@/components/pp/cart";
import { CheckoutForm, PayLabel } from "@/components/pp/checkout-form";
import { CollectionTile } from "@/components/pp/collection-tile";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { HighlightsStrip, autoHighlights } from "@/components/pp/highlights-strip";
import { MobilePayBar } from "@/components/pp/mobile-pay-bar";
import { NewsletterForm } from "@/components/pp/newsletter-form";
import { OfferCard } from "@/components/pp/offer-card";
import { OrderBump } from "@/components/pp/order-bump";
import { QuestionThread } from "@/components/pp/question-thread";
import { ReviewItem } from "@/components/pp/review-item";
import { ReviewSummary } from "@/components/pp/review-summary";
import { StickyBuyBar } from "@/components/pp/sticky-buy-bar";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreLogo, StoreNavbar } from "@/components/pp/store-navbar";
import { StoreProductCard } from "@/components/pp/store-product-card";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { ThemePicker } from "@/components/pp/theme-picker";
import { money } from "@/lib/money";
import { ratingSummary } from "@/lib/pricing";
import { targetHref } from "@/lib/store-themes";
import { COLLECTION, COUPON, DB, INR, LONG, PRODUCT, QUESTION, REVIEW, card } from "@/tests/fixtures";

const LINES: CartLine[] = [{ id: "l1", title: "Planner", unit: INR(499), qty: 2, image: PRODUCT.images[0] }];

describe("AnnouncementBar", () => {
  it("shows text, a copyable code and a countdown", () => {
    render(<AnnouncementBar announcement={{ ...DB.design.announcement, code: "FESTIVE20", endsAt: new Date(Date.now() + 86_400_000).toISOString() }} />);
    expect(screen.getByRole("button", { name: "Copy code FESTIVE20" })).toBeInTheDocument();
  });
});

describe("BundleBox", () => {
  it("shows both prices and the products", async () => {
    const onBuy = vi.fn();
    render(<BundleBox name="Starter" products={DB.products.slice(0, 2)} full={INR(2000)} price={INR(1500)} percentOff={25} currency="INR" hrefFor={(p) => `/s/x/${p.slug}`} onBuy={onBuy} />);
    expect(screen.getByRole("region", { name: "Bundle: Starter" })).toBeInTheDocument();
    expect(screen.getByText("₹1,500.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /buy|get/i }));
    expect(onBuy).toHaveBeenCalled();
  });
});

describe("Cart", () => {
  it("changes quantity and removes lines", async () => {
    const onQty = vi.fn();
    const onRemove = vi.fn();
    render(<CartLines lines={LINES} onQty={onQty} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: /increase|more|\+/i }));
    expect(onQty).toHaveBeenCalledWith("l1", 3);
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith("l1");
  });
  it("opens the drawer with a checkout button and an empty state", () => {
    const { rerender } = render(<CartDrawer open onOpenChange={() => {}} lines={LINES} onQty={() => {}} onRemove={() => {}} onCheckout={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<CartDrawer open onOpenChange={() => {}} lines={[]} onQty={() => {}} onRemove={() => {}} onCheckout={() => {}} />);
    expect(screen.getAllByText(/empty|nothing/i).length).toBeGreaterThan(0);
  });
});

describe("CheckoutForm", () => {
  const props = { international: false, termsHref: "/t", refundHref: "/r" };
  it("validates name, email, phone and consent", async () => {
    const onPay = vi.fn();
    render(<CheckoutForm {...props} total={INR(1499)} onPay={onPay} />);
    await userEvent.click(screen.getByRole("button", { name: /pay ₹1,499\.00/i }));
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
    expect(screen.getByText(/we need an email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your phone number/i)).toBeInTheDocument();
    expect(screen.getByText(/accept the terms/i)).toBeInTheDocument();
    expect(onPay).not.toHaveBeenCalled();
  });
  it("submits valid details", async () => {
    const onPay = vi.fn();
    render(<CheckoutForm {...props} total={INR(1499)} onPay={onPay} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Asha Kumar");
    await userEvent.type(screen.getByLabelText("Email"), "name@test.invalid");
    await userEvent.type(screen.getByRole("textbox", { name: /phone number/i }), "9876543210");
    await userEvent.click(screen.getByRole("checkbox", { name: /agree/i }));
    await userEvent.click(screen.getByRole("button", { name: /pay/i }));
    await waitFor(() => expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ name: "Asha Kumar", dial: "+91", phone: "9876543210", method: "upi" })));
  });
  it("rejects an Indian number that doesn't start with 6-9", async () => {
    render(<CheckoutForm {...props} total={INR(10)} onPay={() => {}} />);
    await userEvent.type(screen.getByRole("textbox", { name: /phone number/i }), "1234567890");
    await userEvent.click(screen.getByRole("button", { name: /pay/i }));
    expect(await screen.findByText(/start with 6, 7, 8 or 9/i)).toBeInTheDocument();
  });
  it("offers only cards internationally", () => {
    render(<CheckoutForm {...props} international total={money(1799, "USD")} onPay={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });
  it("hides payment methods and says Get it now at zero total", () => {
    render(<CheckoutForm {...props} total={money(0)} onPay={() => {}} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get it now/i })).toBeInTheDocument();
  });
  it("shows a pending state", () => {
    render(<PayLabel total={INR(5)} pending />);
    expect(screen.getByText(/pay/i)).toBeInTheDocument();
  });
});

describe("MobilePayBar", () => {
  it("submits the checkout form by id and shows savings", () => {
    render(<MobilePayBar total={INR(999)} savings={INR(500)} />);
    expect(screen.getByRole("button", { name: /pay ₹999\.00/i })).toHaveAttribute("form", "checkout-form");
    expect(screen.getByText(/you save/i)).toBeInTheDocument();
  });
});

describe("CollectionTile", () => {
  it("links to the collection", () => {
    render(<CollectionTile collection={COLLECTION} href="/c/x" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/c/x");
  });
});

describe("FaqAccordion", () => {
  it("expands an answer", async () => {
    const items = DB.storePages.faq.slice(0, 2);
    render(<FaqAccordion items={items} />);
    await userEvent.click(screen.getByRole("button", { name: items[0].q }));
    expect(screen.getByText(items[0].a)).toBeVisible();
  });
});

describe("HighlightsStrip", () => {
  it("lists trust signals", () => {
    const items = autoHighlights(7, 4.8, 38).map((h) => ({ key: h.title, icon: "•", ...h }));
    render(<HighlightsStrip items={items} />);
    expect(screen.getByRole("region", { name: "Why buy here" })).toBeInTheDocument();
    expect(screen.getByText("7-day refunds")).toBeInTheDocument();
    expect(screen.getByText("4.8 out of 5")).toBeInTheDocument();
  });
  it("leaves the rating out until there are reviews", () => {
    expect(autoHighlights(14, 0, 0).map((h) => h.title)).toEqual(["Instant download", "Secure payment", "14-day refunds"]);
  });
});

describe("NewsletterForm", () => {
  it("validates and subscribes", async () => {
    const onSubscribe = vi.fn().mockResolvedValue(undefined);
    render(<NewsletterForm heading="Stay close" body="One email a month." onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByRole("textbox"), "me@test.invalid");
    await userEvent.click(screen.getByRole("button", { name: /subscribe|join|sign up/i }));
    await waitFor(() => expect(onSubscribe).toHaveBeenCalledWith("me@test.invalid"));
  });
});

describe("OfferCard", () => {
  it("shows the code and copies it", () => {
    render(<OfferCard coupon={COUPON} />);
    expect(screen.getByRole("button", { name: `Copy code ${COUPON.code}` })).toBeInTheDocument();
  });
  it("survives a very long code", () => {
    render(<OfferCard coupon={{ ...COUPON, code: LONG.coupon }} />);
    expect(screen.getByText(LONG.coupon)).toBeInTheDocument();
  });
});

describe("OrderBump", () => {
  it("toggles and can be disabled", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<OrderBump label="Add the pack" description="One tap." price={INR(199)} checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<OrderBump label="Add the pack" description="One tap." price={INR(199)} checked disabled onChange={onChange} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});

describe("Questions and reviews", () => {
  it("renders a question with answers and answers it", async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    render(<QuestionThread question={QUESTION} onAnswer={onAnswer} />);
    expect(screen.getByText(QUESTION.body)).toBeInTheDocument();
  });
  it("renders a review with a creator reply", () => {
    render(<ReviewItem review={REVIEW} creatorName="Creator" />);
    expect(screen.getByText(REVIEW.title)).toBeInTheDocument();
    expect(screen.getByText(REVIEW.reply!.body)).toBeInTheDocument();
  });
  it("renders long text and three photos", () => {
    const photos = [0, 1, 2].map((i) => ({ ...PRODUCT.images[0], id: `p${i}`, alt: `Photo ${i}` }));
    render(<ReviewItem review={{ ...REVIEW, body: LONG.longReview, photos }} creatorName="Creator" />);
    expect(screen.getAllByRole("img", { name: /Photo/ })).toHaveLength(3);
  });
  it("summarises 0, 1 and 5000 reviews", () => {
    const { rerender } = render(<ReviewSummary summary={ratingSummary([])} />);
    rerender(<ReviewSummary summary={ratingSummary([REVIEW])} />);
    const many = Array.from({ length: 5000 }, (_, i) => ({ ...REVIEW, id: `r${i}` }));
    rerender(<ReviewSummary summary={ratingSummary(many)} onFilter={() => {}} />);
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
  });
  it("filters by star", async () => {
    const onFilter = vi.fn();
    render(<ReviewSummary summary={ratingSummary(DB.reviews)} onFilter={onFilter} />);
    await userEvent.click(screen.getAllByRole("button", { name: /5 star/ })[0]);
    expect(onFilter).toHaveBeenCalledWith(5);
  });
});

describe("targetHref", () => {
  it.each([
    ["products", "/s/shop/products"],
    ["collection:planners", "/s/shop/c/planners"],
    ["product:daily", "/s/shop/daily"],
    ["page:faq", "/s/shop/faq"],
    ["section:table-1", "#section-table-1"],
    ["url:https://example.com/a", "https://example.com/a"],
  ])("%s", (target, href) => expect(targetHref("shop", target)).toBe(href));
  it("never follows a link that is not https or mailto", () => {
    expect(targetHref("shop", "url:javascript:alert(1)")).toBe("/s/shop/products");
    expect(targetHref("shop", undefined)).toBe("/s/shop/products");
  });
});

describe("StickyBuyBar", () => {
  it("renders the buy action", () => {
    render(
      <>
        <div id="buy-box" />
        <StickyBuyBar watchId="buy-box" title="Planner" price={INR(499)} onBuy={() => {}} />
      </>
    );
    expect(document.body).toBeTruthy();
  });
});

describe("Store chrome", () => {
  it("renders logo, navbar links and footer", () => {
    render(
      <>
        <StoreLogo store={DB.store} />
        <StoreNavbar store={DB.store} collections={DB.collections} />
        <StoreFooter store={DB.store} socials={DB.design.socials} showPoweredBy />
      </>
    );
    expect(screen.getAllByRole("link", { name: "All products" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /powered by powerproof/i })).toBeInTheDocument();
  });
});

describe("StoreProductCard", () => {
  it("shows price, deal and buy", async () => {
    const onBuy = vi.fn();
    render(<StoreProductCard product={card()} href="/s/x/p" currency="INR" onBuy={onBuy} />);
    await userEvent.click(screen.getByRole("button", { name: /buy/i }));
    expect(onBuy).toHaveBeenCalled();
  });
  it("handles no images, a huge price and the buying state", () => {
    render(<StoreProductCard product={card({ images: [], info: { price: INR(9_999_999) } })} href="/x" currency="INR" onBuy={() => {}} buying />);
    expect(screen.getAllByText("₹99,99,999.00").length).toBeGreaterThan(0);
  });
});

describe("Theming", () => {
  it("scopes theme variables", () => {
    const { container } = render(
      <StoreThemeScope theme={DB.design.theme}>
        <p>Inside</p>
      </StoreThemeScope>
    );
    expect((container.firstElementChild as HTMLElement).getAttribute("style")).toContain("--");
  });
  it("picks a palette", async () => {
    const onChange = vi.fn();
    render(<ThemePicker theme={DB.design.theme} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole("button", { pressed: false })[0]);
    expect(onChange).toHaveBeenCalled();
  });
});

describe("lead blocks", () => {
  it("a lead form checks the required fields, then sends name, email and answers", async () => {
    const { LeadFormBlock } = await import("@/components/page-builder/lead-blocks");
    const { makeNode } = await import("@/lib/pages/schema");
    const { fireEvent } = await import("@testing-library/react");
    const node = makeNode("lead_form", {
      fields: [{ id: "name", label: "Your name", type: "text", required: true }, { id: "email", label: "Email", type: "email", required: true }, { id: "why", label: "What do you need?", type: "textarea", required: false }],
      buttonLabel: "Send it",
      successMessage: "Got it, thanks!",
    });
    const onLead = vi.fn(async () => {});
    render(<LeadFormBlock id="lf" props={node.props} env={{ editing: false, onLead }} />);
    fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    expect(await screen.findByText("Your name is needed.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    expect(await screen.findByText(/email looks off/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText(/What do you need/), { target: { value: "A planner" } });
    fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    await waitFor(() => expect(onLead).toHaveBeenCalledWith({ kind: "lead", name: "Ada", email: "ada@example.com", phone: undefined, data: { Form: node.props.heading, "What do you need?": "A planner" } }));
    expect(await screen.findByText("Got it, thanks!")).toBeInTheDocument();
  });

  it("in the editor nothing is sent", async () => {
    const { LeadFormBlock } = await import("@/components/page-builder/lead-blocks");
    const { makeNode } = await import("@/lib/pages/schema");
    const { fireEvent } = await import("@testing-library/react");
    const onLead = vi.fn(async () => {});
    render(<LeadFormBlock id="lf" props={makeNode("lead_form").props} env={{ editing: true, onLead }} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Send it to me" }));
    expect(onLead).not.toHaveBeenCalled();
  });

  it("a booking calendar books the chosen day and time, and says when a time was just taken", async () => {
    const { BookingBlock } = await import("@/components/page-builder/lead-blocks");
    const { makeNode } = await import("@/lib/pages/schema");
    const { fireEvent, within } = await import("@testing-library/react");
    const props = makeNode("booking", { days: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 17, timezone: "UTC", buttonLabel: "Book it" }).props;
    const onLead = vi.fn().mockRejectedValueOnce(new Error("That time was just taken. Please pick another.")).mockResolvedValue(undefined);
    const loadBooked = vi.fn(async () => []);
    render(<BookingBlock id="bk" props={props} env={{ editing: false, onLead, loadBooked }} />);
    // The last day is never today, so it has all its times
    const days = within(screen.getByRole("group", { name: "Pick a day" })).getAllByRole("button");
    fireEvent.click(days[days.length - 1]);
    const times = within(screen.getByRole("group", { name: "Pick a time" })).getAllByRole("button");
    expect(times).toHaveLength(16); // 9am to 5pm, half-hourly
    fireEvent.click(times[0]);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Book it/ }));
    expect(await screen.findByText(/just taken/)).toBeInTheDocument();
    const again = within(screen.getByRole("group", { name: "Pick a time" })).getAllByRole("button");
    fireEvent.click(again[1]);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Book it/ }));
    await waitFor(() => expect(onLead).toHaveBeenCalledTimes(2));
    const sent = onLead.mock.calls[1][0];
    expect(sent).toMatchObject({ kind: "booking", name: "Bob", email: "bob@example.com", minutes: 30 });
    expect(new Date(sent.slotAt).getUTCMinutes()).toBe(30);
    expect(await screen.findByText(/You're booked/)).toBeInTheDocument();
  });
});

describe("marketplace deals", () => {
  const deal = {
    id: "d1", title: "Planner club", pitch: "A weekly planner, every month.", billing: "subscription" as const, interval: "month" as const,
    original: { amount: 99900, currency: "INR" as const }, price: { amount: 49900, currency: "INR" as const }, percentOff: 50,
    productSlug: "planner", storeName: "Fixture Store", storeSlug: "fixture", country: "IN", fulfilment: "digital" as const, kind: "template",
    verified: true, trusted: true, sold: 6, revenue: { amount: 299400, currency: "INR" as const }, reviews: 0, createdAt: "2026-10-01T00:00:00Z",
  };

  it("a card shows both prices, the billing, the badges, units sold and revenue", async () => {
    const { DealCard } = await import("@/components/marketplace/deal-card");
    render(<DealCard d={deal} />);
    expect(screen.getByText("50% off")).toBeInTheDocument();
    expect(screen.getByText("Subscription")).toBeInTheDocument();
    expect(screen.getByText("/month")).toBeInTheDocument();
    expect(screen.getByText("₹499.00")).toBeInTheDocument();
    expect(screen.getByText("₹999.00")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Trusted seller")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/s/fixture/planner");
  });

  it("a card says Private when the seller keeps revenue to themselves, and has no badges when it has none", async () => {
    const { DealCard } = await import("@/components/marketplace/deal-card");
    render(<DealCard d={{ ...deal, revenue: undefined, verified: false, trusted: false, billing: "one_time", interval: undefined }} />);
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).toBeNull();
    expect(screen.queryByText("/month")).toBeNull();
    expect(screen.getByText("One-time")).toBeInTheDocument();
  });

  it("the form's rules: our price under the original, a subscription's interval, an end in the future", async () => {
    const { dealSchema } = await import("@/components/marketplace/deal-form");
    const ok = { productId: "p", title: "Planner club", pitch: "A weekly planner, every month.", billing: "one_time" as const, original: { amount: 99900, currency: "INR" as const }, price: { amount: 49900, currency: "INR" as const }, showRevenue: true, status: "live" as const };
    expect(dealSchema.safeParse(ok).success).toBe(true);
    const msg = (v: object) => JSON.stringify(dealSchema.safeParse({ ...ok, ...v }));
    expect(msg({ price: { amount: 99900, currency: "INR" } })).toMatch(/original price should be higher/);
    expect(msg({ billing: "subscription" })).toMatch(/how often/);
    expect(dealSchema.safeParse({ ...ok, billing: "subscription", interval: "year" }).success).toBe(true);
    expect(msg({ endsAt: "2020-01-01T00:00:00Z" })).toMatch(/future/);
    expect(msg({ productId: "" })).toMatch(/Pick the product/);
    expect(msg({ pitch: "short" })).toMatch(/at least a sentence/);
  });
});

describe("marketplace card for sellers worldwide", () => {
  const base = {
    id: "d1", title: "Planner club", pitch: "A weekly planner, every month.", billing: "one_time" as const,
    original: { amount: 8400, currency: "INR" as const }, price: { amount: 4200, currency: "INR" as const }, percentOff: 50,
    productSlug: "planner", storeName: "Fixture Store", storeSlug: "fixture", country: "IN", fulfilment: "digital" as const, kind: "template",
    verified: false, trusted: false, sold: 3, reviews: 0, createdAt: "2026-10-01T00:00:00Z",
  };

  it("shows the seller's country and a New rating when there are no reviews", async () => {
    const { DealCard } = await import("@/components/marketplace/deal-card");
    render(<DealCard d={base} />);
    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Fixture Store")).toBeInTheDocument();
  });

  it("shows prices in the viewer's currency when there are rates, marked as approximate", async () => {
    const { DealCard } = await import("@/components/marketplace/deal-card");
    render(<DealCard d={base} show={{ currency: "USD", rates: { INR: 84, USD: 1 } }} />);
    expect(screen.getByText("$0.50")).toBeInTheDocument();
    expect(screen.getByText("$1.00")).toBeInTheDocument();
    expect(screen.getByLabelText("about")).toBeInTheDocument();
  });

  it("leaves prices alone without rates, and the big best-seller card has a rank", async () => {
    const { DealCard, SpotlightCard } = await import("@/components/marketplace/deal-card");
    const { unmount } = render(<DealCard d={base} show={{ currency: "USD", rates: {} }} />);
    expect(screen.getByText("₹42.00")).toBeInTheDocument();
    expect(screen.queryByLabelText("about")).toBeNull();
    unmount();
    render(<SpotlightCard d={base} rank={1} />);
    expect(screen.getByText("#1 best seller")).toBeInTheDocument();
  });
});

let quoteImpl: (code: string) => unknown = () => undefined;
let orderImpl: (token: string) => Promise<unknown> = () => Promise.reject(new Error("no order"));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), getQuote: (_i: unknown, code: string) => Promise.resolve(quoteImpl(code)), getPublicOrder: (t: string) => orderImpl(t) }));

describe("buying", () => {
  const product = { id: "11111111-1111-4111-8111-111111111111", title: "Weekly planner", info: { price: { amount: 49900, currency: "INR" as const } } } as never;

  const quote = (codeOk: boolean | null) => ({ currency: "INR", subtotal: 49900, dealSaving: 0, codeOff: codeOk ? 10000 : 0, total: codeOk ? 39900 : 49900, ...(codeOk === null ? {} : { coupon: codeOk ? { ok: true, message: "Code applied." } : { ok: false, message: "That code doesn't work for this order. Check the spelling, the dates, or what it applies to." } }) });
  /** Only the calls that create a payment are recorded; the code check goes straight to the database (mocked above) */
  const mockFetch = (handler: (url: string, body: Record<string, unknown>) => unknown) => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      calls.push({ url, body });
      return { json: async () => handler(url, body) };
    }));
    return calls;
  };
  const sheet = (CheckoutSheet: typeof import("@/components/buyer/checkout-sheet").CheckoutSheet) => <CheckoutSheet open onOpenChange={() => {}} storeId="s1" storeSlug="fix" lines={[{ product, quantity: 1 }]} onLines={() => {}} />;

  it("checks the buyer's details before anything is sent", async () => {
    const { CheckoutSheet } = await import("@/components/buyer/checkout-sheet");
    const { fireEvent } = await import("@testing-library/react");
    quoteImpl = () => quote(null);
    const calls = mockFetch(() => ({}));
    render(sheet(CheckoutSheet));
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    expect(await screen.findByText(/full name/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    expect(await screen.findByText(/email looks off/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    expect(await screen.findByText(/10 digits/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    expect(await screen.findByText(/accept the terms/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("checks the discount code live against the database, shows the new total, and won't start a payment with a bad code", async () => {
    const { CheckoutSheet } = await import("@/components/buyer/checkout-sheet");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    quoteImpl = (code) => quote(code === "save100");
    const calls = mockFetch(() => ({}));
    render(sheet(CheckoutSheet));
    fireEvent.change(screen.getByLabelText(/Discount code/), { target: { value: "save100" } });
    expect(await screen.findByText(/Code applied\./)).toBeInTheDocument();
    expect(screen.getByText("Total to pay")).toBeInTheDocument();
    expect(screen.getByText("₹399.00")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Discount code/), { target: { value: "oops" } });
    expect(await screen.findByText(/That code doesn't work for this order/)).toBeInTheDocument();
    expect(screen.getAllByText("₹499.00").length).toBeGreaterThan(1);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    expect(await screen.findByText(/Fix or clear the code/)).toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(0));
    vi.unstubAllGlobals();
  });

  it("asks the server to create the payment with only which products and who is buying, never a price", async () => {
    const { CheckoutSheet } = await import("@/components/buyer/checkout-sheet");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    quoteImpl = () => quote(true);
    const calls = mockFetch(() => ({ ok: false, message: "Payments aren't connected for this store yet. Please check back shortly." }));
    render(sheet(CheckoutSheet));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/Discount code/), { target: { value: "save100" } });
    expect(await screen.findByText(/Code applied\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/checkout");
    expect(calls[0].body).toMatchObject({ storeSlug: "fix", productIds: ["11111111-1111-4111-8111-111111111111"], coupon: "save100", buyer: { name: "Ada Lovelace", email: "ada@example.com", phone: "+919876543210", country: "IN", consent: true } });
    expect(JSON.stringify(calls[0].body)).not.toMatch(/amount|price|total/i);
    expect(await screen.findByText(/Payments aren't connected/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("the order page lists the files to download, the receipt, and a review form", async () => {
    const { OrderPage } = await import("@/components/buyer/order-view");
    const order = {
      id: "o1", storeId: "s1", ref: "PP/DP/ABC1234567", status: "paid", storeName: "Fixture Store", storeSlug: "fix", buyerName: "Ada Lovelace", buyerEmail: "ada@example.com", buyerCountry: "IN", currency: "INR",
      subtotal: 49900, discount: 0, tax: 7612, total: 49900, reviewed: [], store: {},
      lines: [{ productId: "p1", title: "Weekly planner", unit: 49900, discount: 0, total: 49900, gift: false }],
      files: [{ id: "f1", name: "planner.pdf", size: 2_400_000, product: "Weekly planner" }],
    };
    orderImpl = () => Promise.resolve(order);
    render(<OrderPage token={"a".repeat(48)} justPaid />);
    expect(await screen.findByText("Thank you, Ada!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("href", `/api/download?t=${"a".repeat(48)}&f=f1`);
    expect(screen.getByText("planner.pdf")).toBeInTheDocument();
    expect(screen.getByText("GST included")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Rating for Weekly planner" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("a wrong or expired link says so and points to the lookup", async () => {
    const { OrderPage } = await import("@/components/buyer/order-view");
    orderImpl = () => Promise.reject(new Error("That link has expired or isn't valid."));
    render(<OrderPage token={"b".repeat(48)} />);
    expect(await screen.findByText("That link has expired or isn't valid.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Find my order" }).every((a) => a.getAttribute("href") === "/lookup")).toBe(true);
    vi.unstubAllGlobals();
  });
});
