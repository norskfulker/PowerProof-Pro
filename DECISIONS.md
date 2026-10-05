# Decisions and open questions

Small calls made while building the frontend, so the founder can check them in one place. Everything here is easy to change.

## Stack

| Choice | Why |
| --- | --- |
| Next.js 16.3 (App Router), React 19, TypeScript | Latest stable at build time. Deploys to Vercel as is. |
| Tailwind CSS v4 with tokens in `app/globals.css` | v4 is what `create-next-app` ships. Tokens are CSS variables mapped through `@theme`. |
| shadcn/ui, new-york style, Radix primitives | As specified. Components live in `components/ui` and are restyled in place. The shadcn CLI wrote `import { cn } from "cn"` (an unrelated npm package) into every component; I fixed the imports and removed that package. |
| TanStack Table **v8** | v9 shipped with a different API. v8 is stable and documented. |
| zod 3 + react-hook-form | zod 3 is what `@hookform/resolvers` pairs with here. |
| Recharts 3 | Charts read colours from CSS variables (`var(--chart-1)` etc.). |
| React Email | Templates in `/emails`, rendered in the browser at `/emails/*`. |

## Mock data layer

- **Pages only import `@/lib/api`.** `lib/mock/*` is imported by `lib/api/*` and nothing else. To connect the backend, replace each function body in `lib/api` with a `fetch`. Signatures and types stay the same.
- **Types live in `lib/types/`** (one file per area, re-exported from `index.ts`).
- **Data runs in the browser.** Pages fetch through the `useApi` hook, so loading skeletons are real (300 to 600 ms of simulated latency in `lib/api/client.ts`).
- **The mock database persists to `localStorage`** (`pp:db`). That keeps the walkthrough working across reloads, and across tabs: a buyer paying in one tab shows up on the creator's dashboard in another. Cross-tab updates use the `storage` event plus a cheap revision check every 2.5 s and on focus, because some embedded browsers don't deliver `storage`.
- **Demo controls** live in the avatar menu under *Demo data*: load sample data, start with an empty store, simulate errors (every API call fails, to review error states).
- **Sign up creates a new, empty store.** Log in opens whatever store is in the browser (sample data by default).
- **Seeded store:** "Ananya Makes" (`/s/ananya`), 12 products, 40 orders, 25 customers in 8 countries, 6 payouts. Generated with a fixed seed so it looks the same on every load. Dates are relative to "now".
- **Admin data** (creators, disputes, payout queue, flags) is separate platform-wide mock data in `lib/mock/admin.ts`. Admin orders show the demo store's real orders.

## Money

- Money is always `{ amount: integer minor units, currency }`. `MoneyText` and `formatMoney` are the only formatters. INR uses Indian digit grouping (₹1,52,400.00).
- **Store currency is INR.** Prices are set in rupees.
- **Buyers see their own currency**, guessed from their timezone and changeable in the header, saved per browser. Conversion uses a fixed mock rate table (`INR_PER` in `lib/money.ts`) and rounds to .99 above one unit.
- **Assumption: buyers are charged in their own currency** and the creator settles in INR. Razorpay supports this for international cards. A small note under prices says so.
- **Fees:** 3% platform plus about 2% gateway, both worked out on the INR price. Subscription is $20/month after a free first month; the calculator converts it at the mock rate (₹83.40).
- **Settlement: T+2.** Sales are pending for two days, then available. Refund requests stay in pending until they're resolved.
- **Withdrawals:** minimum ₹100.00, no fee, to a verified bank account. USDT shows as "coming soon" and can't be picked.

## Product and content

- **Three ways to add a product:** paste a link (`/products/new/link`, mock autofill returns a title, price, description and three generated covers for any URL), upload a file (`/products/new/upload`), or create a page (`/products/new/page`: creates a draft product plus a page, then opens the editor).
- **A product needs a file before it can be published.** The schema enforces this in the editor and in onboarding.
- **Upload limit shown as 2 GB per file.** Confirm against the storage plan.
- **Product covers are generated art** (`CoverArt`). Six layouts drawn the same way in HTML and on canvas, so the image maker's PNG export matches what the store shows. Uploaded images use object URLs in the mock.
- **Custom pages:** a *live* page that sells a product replaces that product's default page at the same URL (`/s/[store]/[product]`). Pages not tied to a product aren't public yet.
- **Paste HTML mode:** pasted `<script>` tags are stripped on save. The page renders in a sandboxed iframe. Any element with `data-pp-buy="PRODUCT_ID"` becomes a buy button that starts checkout. The embed snippet (`embed.js`) is shown but **not built**; it's backend/CDN work.
- **Store URLs** are shown as `powerproof.store/<slug>`; in this app they live at `/s/<slug>`.

## Checkout and payments

- **PowerProof never renders card fields.** "Pay" opens a sheet that stands in for the gateway's own checkout (Razorpay Checkout in production), with *Approve* and *Simulate a declined payment* buttons.
- Indian buyers can pick UPI, card or netbanking. International buyers pay by card.
- Buyers don't need an account. Order lookup by email lives at `/lookup`.
- Downloads in the mock save a small text file that stands in for a signed, expiring link.

## Tax and invoices

- Prices **include** GST by default (switchable in Settings › Tax).
- Invoice logic in `lib/invoice.ts`: not registered → no GST; buyer outside India → export of services, zero-rated under LUT; buyer in India → IGST, or CGST+SGST when the buyer is in the seller's state. The buyer's state isn't collected yet, so Indian sales default to IGST.
- Default codes are SAC 9984xx (online content) at 18%. Creators can add HSN codes too.
- Invoice numbers are `PREFIX-0001` style, sequential per store.

## Design system

- Tokens are in `app/globals.css`. Components use tokens only. **Exceptions** (all creator data or places CSS variables can't reach): product cover and image-maker palettes, the store brand colour, email templates (`emails/theme.ts` keeps a literal copy of the tokens because email clients ignore CSS variables), the HTML editor's default buy-button style inside the sandbox, and `themeColor` in the root layout.
- **Contrast fixes beyond the brief:** small brass text uses `--accent-ink` (#7A5C20), warning text uses `--warning-ink` (#8A5A12), and input borders use `--input` (#8F9B95, 3:1 against white). Brass #A9823A / #C9A24F stays for large numbers and fills.
- Radius tokens: `rounded-control` 10px, `rounded-media` 12px, `rounded-card` 16px, `rounded-dialog` 20px; pills are the only `rounded-full`.
- **Dialogs only for destructive actions**, plus the withdraw dialog the brief asks for. Template previews, bank forms, SKU and tax-code editing, the image maker and the payment hand-off use sheets.
- Light theme only. Dark mode hook: set `data-theme="dark"` on `<html>` and redefine the tokens; the `dark:` variant is already wired to that attribute.
- Fonts load through `next/font/google`, which self-hosts them at build time (no runtime calls to Google).
- `/design` is the reference: every token, component and state.

## Navigation

- Creator sidebar has a *Coming later* group (Webinars, Courses, Physical items) shown disabled with a "SOON" tag.
- Store switcher shows one store plus a disabled "Add another store".
- Mobile: bottom tab bar (Home, Products, Orders, Payouts, More). *More* opens the full menu in a sheet.

## Not built (needs backend or a later phase)

Real auth and route guards, file storage and signed URLs, the gateway integration and webhooks, real email sending, `embed.js`, custom domains and logo upload, multi-store, team permissions enforcement, analytics ingestion (visitor numbers are synthetic), GA/Clarity script injection on buyer pages.

## Questions for the founder

1. **GST on PowerProof's fees:** should the pricing page and calculator show 18% GST on the 3% fee (and on the gateway fee)? Right now fees are shown before GST.
2. **Buyer currency:** charge international buyers in their currency (current assumption), or always charge INR and only *display* local prices?
3. **Settlement and holds:** is T+2 right for Razorpay Route on day one? New accounts often start at T+7. Should refund requests hold money as they do now?
4. **Minimum withdrawal** ₹100: keep?
5. **Refund policy:** the default is 7 days, set per store. Should PowerProof enforce a platform minimum?
6. **Upload limit:** is 2 GB per file right for the storage plan?
7. **Invoices:** confirm the GST treatment with your CA, especially exports under LUT and whether to collect the buyer's state for Indian B2C sales.
8. **Trial:** does the free month need a card up front? Currently it doesn't.
9. **USDT:** which network (TRC-20 assumed) and when?
10. **Brand colour on stores:** creators can pick from six palettes. Allow any colour (with a contrast check)?

---

# Buyer store spec (overrides earlier parts where they conflict)

## What changed from the first build

- **No cart for digital products.** Every product has one Buy now that goes straight to checkout. Cart pieces exist (`components/pp/cart.tsx`: drawer, lines, totals) for physical products later; no digital store renders them. They're shown on `/design`.
- **No buyer accounts anywhere.** Buyers get back to their files from the receipt email, the success page, or `/lookup`, which emails a fresh link to `/order/[token]`. The old `/download/[orderId]` route now forwards to `/order/[token]`.
- **Guest checkout requires full name, email and phone** (with a country code picker and per-country length rules). One step. Coupon at checkout only. Pay button always shows the exact total.
- **Custom domains:** `/store/domain` shows the field disabled with Coming soon. Stores live at `/s/[store]`.

## Store design ("fixed and proven, not a page builder")

- The store layout is fixed. Creators toggle 11 sections on or off and reorder them with arrows in `/store/design` (navbar and footer always on).
- **Themes are token overrides scoped to the store root** (`lib/store-themes.ts`, `StoreThemeScope`). Six palettes, an optional accent colour (soft/strong/ink variants are derived with `color-mix`), three font pairings, three hero layouts. Because components read tokens, every store component works in every theme with no per-theme code.
- **Font pairings:** Modern (Bricolage Grotesque + Hanken Grotesk), Editorial (Fraunces + Hanken Grotesk), Clean (Space Grotesk + IBM Plex Sans). All self-hosted through `next/font`.
- **Live preview** is the real store in an iframe; the editor posts the draft design in with `postMessage`, so the preview is exactly what buyers get. Desktop renders at 1280px and is scaled to fit; mobile at 390px.
- The earlier **Pages** feature (templates, visual editor, paste HTML) is kept as **Sales pages** for creators who want a longer sales page. A live sales page for a product now renders inside that product's Description section instead of replacing the store's product layout.

## Catalogue, offers, pricing

- **Collections** are curated lists with a tile colour. Collections with no published products are hidden from buyers.
- **Deals** take a percent off listed products (or everything) between two times. A live deal shows a Deal badge on cards, a countdown on the product page, a banner on the home Offers section, and changes the price everywhere, including checkout.
- **Coupons:** percent or fixed, optional expiry, usage limit, minimum spend, whole store or chosen products. One coupon per order. Usage counts up when an order is paid.
- **Bundles:** 2 to 5 products at a set price or percent off. At checkout the bundle price is spread across its items in proportion, so invoices and refunds stay per product.
- **Order bump:** one optional add-on per store, at a fixed add-on price, set in Store design › Content.
- **Tax line at checkout:** GST shown as included for buyers in India; "Nil, export" for buyers abroad (same treatment as the invoice; still needs a CA's confirmation).

## Reviews and questions

- **Verified buyers only.** The review form lives on `/order/[token]` (linked from the success page and the review-request email). One review per product per order. Names show as first name plus initial.
- Creators can **reply once** (labelled Creator), **pin up to 3**, **hide**, and **report**. They cannot edit stars or text. Imported testimonials are labelled Imported and don't count towards the average.
- **Helpful votes are limited per device** with `localStorage`. A real backend should also rate-limit per IP.
- **Reports** from reviews and questions show up in the founder admin's Flagged content. Removing a flag hides the item; dismissing clears the report.
- **Questions:** anyone can ask with name and email (only the first name is shown). The creator answers from `/store/questions`; verified buyers can answer from their order page. Answers are one level deep. The "question answered" email is previewed at `/emails/question-answered`.

## Mock data

- Three stores: **Ananya Makes** (`/s/ananya`, kits and presets, the logged-in creator's store), **Inkwell Ebooks** (`/s/inkwell`, ebooks, Midnight + Editorial + centered hero), **Grid & Grain Studio** (`/s/gridgrain`, design templates, Graphite + Clean + full-width hero).
- Each store: 15 products, 6 collections, 4 coupons (one expired, to show the error), 2 bundles, 1 live 48-hour deal. 60 reviews in total (some with photos and creator replies) and 20 questions (most answered).
- The two extra stores are public and buyable, but read-only from the creator app (which manages Ananya's store). Their orders stay on their own store.
- The mock database version moved to 4, so old browser data is replaced with the new seed on first load.

## Questions for the founder (store)

1. **Phone at checkout:** required, as specified. That adds friction for international buyers; keep it required for them too?
2. **One coupon per order:** OK, or should coupons stack with deals? Right now a coupon applies on top of deal prices.
3. **Review request timing:** the email says 5 days after purchase. Right number?
4. **Order bump pricing:** the add-on price is set by the creator with no floor. Should PowerProof enforce a minimum?
5. **"Powered by PowerProof"** is shown on every store. The setting exists (`showPoweredBy`) but there's no toggle until the paid-plan rule is decided.
