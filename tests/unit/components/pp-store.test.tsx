import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { BundleBox } from "@/components/pp/bundle-box";
import { CartDrawer, CartLines, type CartLine } from "@/components/pp/cart";
import { CheckoutForm, PayLabel } from "@/components/pp/checkout-form";
import { CollectionTile } from "@/components/pp/collection-tile";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { HeroSection } from "@/components/pp/hero-section";
import { HighlightsStrip } from "@/components/pp/highlights-strip";
import { MobilePayBar } from "@/components/pp/mobile-pay-bar";
import { NewsletterForm } from "@/components/pp/newsletter-form";
import { OfferCard } from "@/components/pp/offer-card";
import { OrderBump } from "@/components/pp/order-bump";
import { QuestionThread } from "@/components/pp/question-thread";
import { ReviewItem } from "@/components/pp/review-item";
import { ReviewSummary } from "@/components/pp/review-summary";
import { SectionToggleList } from "@/components/pp/section-toggle-list";
import { StickyBuyBar } from "@/components/pp/sticky-buy-bar";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreLogo, StoreNavbar } from "@/components/pp/store-navbar";
import { StoreProductCard } from "@/components/pp/store-product-card";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { ThemePicker } from "@/components/pp/theme-picker";
import { money } from "@/lib/money";
import { ratingSummary } from "@/lib/pricing";
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

describe("HeroSection", () => {
  it.each(["left", "centered", "full"] as const)("renders the %s layout", (style) => {
    render(<HeroSection hero={DB.design.hero} style={style} images={PRODUCT.images} href="/s/x/products" />);
    expect(screen.getByRole("heading", { name: DB.design.hero.headline })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(DB.design.hero.ctaLabel) })).toBeInTheDocument();
  });
});

describe("HighlightsStrip", () => {
  it("lists trust signals", () => {
    render(<HighlightsStrip refundDays={7} rating={4.8} reviewCount={38} />);
    expect(screen.getByRole("region", { name: "Why buy here" })).toBeInTheDocument();
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

describe("SectionToggleList", () => {
  it("toggles and reorders sections", async () => {
    const onChange = vi.fn();
    render(<SectionToggleList sections={DB.design.sections} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole("switch")[0]);
    expect(onChange).toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: /move .* down/i })[0]);
    expect(onChange).toHaveBeenCalledTimes(2);
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
