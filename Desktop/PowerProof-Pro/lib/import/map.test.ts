import { describe, expect, it } from "vitest";
import { applyCheck, convertPrices, fromPageMarkup, fromJsonLd, fromShopifyPublic, fromWooStore, htmlToText, isVideoFile, shopifyVideo, toMajor, toMinor, wordsAndPrice } from "./map";

describe("helpers", () => {
  it("turns product HTML into plain paragraphs and safe text", () => {
    expect(htmlToText("<p>Soft <b>cotton</b> tee</p><ul><li>S</li><li>M</li></ul><script>alert(1)</script>&amp; more&nbsp;here")).toBe("Soft cotton tee\n\n• S\n• M\n\n& more here");
  });
  it("reads prices into minor units", () => {
    expect(toMinor("1,299.50", "INR")).toBe(129950);
    expect(toMinor(12, "USD")).toBe(1200);
    expect(toMinor("1500", "JPY")).toBe(1500);
    expect(toMinor("-3")).toBe(0);
  });
});

describe("Shopify", () => {
  it("maps a Shopify website's public products", () => {
    const [p] = fromShopifyPublic([{ id: 5, title: "Mug", handle: "mug", options: [{ name: "Colour" }], images: [{ src: "//cdn.shopify.com/m.jpg" }], variants: [{ id: 1, title: "Red", price: "300.00", option1: "Red", requires_shipping: true }, { id: 2, title: "Blue", price: "320.00", option1: "Blue", requires_shipping: true }] }], "INR", "https://mugs.example");
    expect(p.options).toEqual([{ name: "Colour", values: ["Red", "Blue"] }]);
    expect(p.variants[1]).toMatchObject({ options: ["Blue"], price: 32000 });
    expect(p.images[0].src).toBe("https://cdn.shopify.com/m.jpg");
    expect(p.sourceUrl).toBe("https://mugs.example/products/mug");
  });
});

describe("WooCommerce", () => {
  it("maps a WooCommerce website's Store API, already in minor units", () => {
    const [p] = fromWooStore([{ id: 9, name: "Jar &amp; Lid", prices: { price: "45000", regular_price: "50000", currency_code: "INR", currency_minor_unit: 2 }, images: [{ src: "https://w.test/j.jpg" }] }], "USD");
    expect(p).toMatchObject({ title: "Jar & Lid", price: 45000, compareAt: 50000, currency: "INR" });
  });
});

describe("a website's product data", () => {
  it("finds products in JSON-LD, including in @graph, with offers and variants", () => {
    const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"X"},{"@type":"ProductGroup","name":"Bag","productGroupID":"BAG","variesBy":["https://schema.org/color"],"image":["https://site.test/bag.jpg"],"hasVariant":[{"@type":"Product","sku":"BAG-R","color":"Red","offers":{"price":"1500","priceCurrency":"INR"}},{"@type":"Product","sku":"BAG-B","color":"Blue","offers":{"price":"1600","priceCurrency":"INR"}}]}]}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Cap","sku":"CAP","offers":{"@type":"Offer","price":12.5,"priceCurrency":"USD","availability":"https://schema.org/OutOfStock"},"image":{"@type":"ImageObject","url":"https://site.test/cap.jpg"}}</script>
      <script type="application/ld+json">{broken</script></html>`;
    const [bag, cap] = fromJsonLd(html, "https://site.test/shop", "INR");
    expect(bag.options).toEqual([{ name: "color", values: ["Red", "Blue"] }]);
    expect(bag.variants.map((v) => v.price)).toEqual([150000, 160000]);
    expect(cap).toMatchObject({ price: 1250, currency: "USD", live: false, images: [{ src: "https://site.test/cap.jpg", alt: "" }] });
  });
});

describe("converting prices", () => {
  it("converts other currencies at today's rate and says so", () => {
    const [cap] = fromJsonLd(`<script type="application/ld+json">{"@type":"Product","name":"Cap","offers":{"price":"10","priceCurrency":"USD"}}</script>`, "https://s.test", "INR");
    const r = convertPrices([cap], "INR", { USD: 1, INR: 84 });
    expect(r.products[0]).toMatchObject({ currency: "INR", price: 84000 });
    expect(r.products[0].problems.at(-1)).toMatch(/converted from USD/);
    expect(r.warning).toMatch(/converted/);
    expect(convertPrices([cap], "INR", {}).warning).toMatch(/couldn't be converted/);
  });
});

describe("from a link: words and price only", () => {
  const ld = `<script type="application/ld+json">{"@type":"Product","name":"Linen Tote | Buy online at Brandsite","sku":"LT-1","description":"<p>Sturdy linen tote.</p><p>Free shipping over ₹999!</p>","image":["https://cdn.example.com/a.jpg"],"offers":{"price":"1299.00","priceCurrency":"INR","availability":"https://schema.org/InStock"}}</script>`;
  const read = fromJsonLd(ld, "https://brandsite.com/p/linen-tote", "INR")[0];

  it("leaves pictures, SKUs, variants and stock behind and stays a draft", () => {
    const p = wordsAndPrice(read);
    expect(p).toMatchObject({ price: 129900, currency: "INR", sku: "", images: [], variants: [], options: [], trackStock: false, live: false, sourceUrl: "https://brandsite.com/p/linen-tote" });
    expect(p.problems).toContain("Add a picture.");
  });

  it("takes the AI's fixes and its notes", () => {
    const p = applyCheck(wordsAndPrice(read), { key: read.key, title: "Linen Tote", description: "Sturdy linen tote.", price: 999, compareAt: 1299, currency: "INR", fulfilment: "physical", notes: ["Price is the sale price."] });
    expect(p).toMatchObject({ title: "Linen Tote", description: "Sturdy linen tote.", price: 99900, compareAt: 129900 });
    expect(p.problems).toEqual(["Add a picture.", "Price is the sale price."]);
  });

  it("keeps what was read when the AI's answer doesn't make sense", () => {
    const base = wordsAndPrice(read);
    const p = applyCheck(base, { key: read.key, title: "  ", description: "", price: -5, currency: "rupees", fulfilment: "boxed" as "physical", notes: [] });
    expect(p).toMatchObject({ title: base.title, description: base.description, price: 129900, currency: "INR", fulfilment: "physical" });
    expect(applyCheck(base, undefined)).toBe(base);
  });

  it("shows prices as written, zero-decimal currencies too", () => {
    expect(toMajor(49900, "INR")).toBe(499);
    expect(toMajor(1500, "JPY")).toBe(1500);
  });
});

describe("Shopify's public feed in a visitor's currency", () => {
  it("uses the currency each variant says its price is in", () => {
    const [p] = fromShopifyPublic([{ id: 1, title: "Board", handle: "board", body_html: "", variants: [{ id: 2, title: "Default Title", price: "74100.00", price_currency: "INR" }], options: [{ name: "Title" }] } as never], "USD", "https://shop.test");
    expect(p).toMatchObject({ price: 7410000, currency: "INR" });
  });
});

describe("a product page without product data (Amazon's layout)", () => {
  const html = `<html><head><title>Amazon.in: Buy Kettle</title><meta name="description" content="Amazon.in: Buy Steel Kettle online">
    <link rel="canonical" href="https://www.amazon.in/Steel-Kettle/dp/B000TEST01"></head><body>
    <span id="productTitle" class="a-size-large"> Steel Kettle 1.5L | Auto Cut-off | 2 Year Warranty | Fast Boil | Cool Touch Handle </span>
    <div id="corePriceDisplay_desktop_feature_div"><span class="a-price priceToPay"><span class="a-offscreen">₹1,299</span><span class="a-price-symbol">₹</span><span class="a-price-whole">1,299</span></span>
    M.R.P.: <span class="a-price a-text-price"><span class="a-offscreen">₹2,499</span></span></div>
    <div id="feature-bullets"><ul><li><span class="a-list-item">✔️ 𝐅𝐀𝐒𝐓 𝐁𝐎𝐈𝐋: 1.5 litres in 4 minutes</span></li><li><span class="a-list-item">Auto cut-off</span></li></ul></div>
    <div id="productDescription" class="a-section"><p>A sturdy steel kettle.</p></div></div></div></body></html>`;

  it("reads the title, the price to pay, the M.R.P. and the bullets, with a clean link", () => {
    const p = fromPageMarkup(html, "https://www.amazon.in/x/dp/B000TEST01/ref=abc?th=1&pd_rd=zzz", "USD");
    expect(p).toMatchObject({ title: "Steel Kettle 1.5L", price: 129900, compareAt: 249900, currency: "INR", images: [], sourceUrl: "https://www.amazon.in/Steel-Kettle/dp/B000TEST01" });
    expect(p?.description).toContain("• FAST BOIL: 1.5 litres in 4 minutes");
    expect(p?.description).toContain("A sturdy steel kettle.");
  });

  it("finds nothing on a page with no product name", () => {
    expect(fromPageMarkup("<html><body><p>hi</p></body></html>", "https://site.test/", "INR")).toBeUndefined();
  });
});

describe("pictures and video from a link", () => {
  const amazon = `<span id="productTitle">Kettle</span><script>'colorImages': { 'initial': A.$.parseJSON('[{"hiRes":"https://m.media-amazon.com/images/I/AAA._SL1500_.jpg","large":"https://m.media-amazon.com/images/I/AAA.jpg","main":{"https://m.media-amazon.com/images/I/AAA._SX679_.jpg":[679,679]}},{"hiRes":null,"large":"https://m.media-amazon.com/images/I/BBB.jpg","main":{}}]')},</script>
    <script>"hiRes":"https://m.media-amazon.com/images/I/OTHER._SL1500_.jpg"</script><div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">₹999</span></span></div>`;

  it("takes this product's gallery, the high-resolution file per shot, and not similar items", () => {
    const p = fromPageMarkup(amazon, "https://www.amazon.in/dp/X", "INR");
    expect(p?.images.map((i) => i.src)).toEqual(["https://m.media-amazon.com/images/I/AAA._SL1500_.jpg", "https://m.media-amazon.com/images/I/BBB.jpg"]);
  });

  it("keeps pictures and video only when asked", () => {
    const p = { ...fromPageMarkup(amazon, "https://www.amazon.in/dp/X", "INR")!, video: { src: "https://cdn.test/v.mp4" } };
    expect(wordsAndPrice(p).images).toEqual([]);
    expect(wordsAndPrice(p).video).toBeUndefined();
    expect(wordsAndPrice(p, true)).toMatchObject({ images: [{}, {}], video: { src: "https://cdn.test/v.mp4" } });
    expect(wordsAndPrice(p, true).problems).not.toContain("Add a picture.");
  });

  it("only copies plain video files, never streams", () => {
    expect(isVideoFile("https://cdn.test/a.mp4?v=2")).toBe(true);
    expect(isVideoFile("https://cdn.test/a.webm")).toBe(true);
    expect(isVideoFile("https://m.media-amazon.com/x/default.jobtemplate.hls.m3u8")).toBe(false);
  });

  it("picks a Shopify product's MP4 nearest 720p, with its poster", () => {
    const v = shopifyVideo({ media: [{ media_type: "image" }, { media_type: "video", preview_image: { src: "//cdn.shopify.com/p.jpg" }, sources: [{ format: "m3u8", url: "https://cdn.shopify.com/v.m3u8" }, { format: "mp4", url: "https://cdn.shopify.com/v1080.mp4", height: 1080 }, { format: "mp4", url: "https://cdn.shopify.com/v720.mp4", height: 720 }] }] });
    expect(v).toEqual({ src: "https://cdn.shopify.com/v720.mp4", poster: "https://cdn.shopify.com/p.jpg" });
    expect(shopifyVideo({ media: [] })).toBeUndefined();
  });
});
