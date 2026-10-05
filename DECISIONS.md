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

- Tokens are in `app/globals.css`. Components use tokens only. **Exceptions** (all creator data or places CSS variables can't reach): product cover and tile palettes (`lib/palettes.ts`), the store brand colour, email templates (`emails/theme.ts` keeps a literal copy of the tokens because email clients ignore CSS variables), the HTML editor's default buy-button style inside the sandbox, and `themeColor` in the root layout.
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

## Store design (the store home is fixed and proven; extra pages use the visual editor)

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
- The mock database version is now 7 (deal-path rules, visual pages and the audit log were added), so old browser data is replaced with the new seed on first load.

## Questions for the founder (store)

1. **Phone at checkout:** required, as specified. That adds friction for international buyers; keep it required for them too?
2. **One coupon per order:** OK, or should coupons stack with deals? Right now a coupon applies on top of deal prices.
3. **Review request timing:** the email says 5 days after purchase. Right number?
4. **Order bump pricing:** the add-on price is set by the creator with no floor. Should PowerProof enforce a minimum?
5. **"Powered by PowerProof"** is shown on every store. The setting exists (`showPoweredBy`) but there's no toggle until the paid-plan rule is decided.

## Global search (Part 4A)

- **One index, two scopes.** `lib/api/search.ts` builds one list of searchable records. The founder admin searches every store; creators search only their own (same palette, fewer types, no masking).
- **Patterns:** `#1042` / `PP-1042` / a bare 3 to 6 digit number is an order number; anything with `@` is an email; `+91 98…` or 7+ digits is a phone; `@slug` limits to one store (`@inkwell freelance`); `INV-` is an invoice. Everything else is matched word by word.
- **Masking:** for admins, buyer and creator emails show as `pr••••@gmail.com` and phones as `+91 ••••••3210`. The raw values are used for matching but never leave the API. **Reveal** asks for an optional reason and writes who, when, what and why to the audit log (`/admin/audit`, newest first, last 500 kept).
- **Quick actions:** open, copy ID, refund, hide review, suspend store. The three that change things always confirm and are logged too.
- **Keyboard:** arrows move, Enter opens, Tab and Shift+Tab jump between groups, Ctrl+Enter moves focus to the actions bar for the highlighted result, Esc closes. Actions live in a bar under the list rather than inside each row, because buttons inside listbox options aren't accessible.
- The platform order list (`/admin/orders`) now includes every store's orders, so links from search always land somewhere.

## Deal paths (Part 4B)

- **Engine:** `lib/pricing/deals.ts` is pure, with no clock or storage access. Checkout, the creator's test mode and the unit tests all call the same `evaluateDeals`.
- **Best price, automatically.** By default the buyer gets the single rule that saves most. Rules marked *stackable* also combine with each other and with the best non-stackable rule; the engine tries each combination and keeps the cheapest valid one.
- **Order of application:** item discounts (bundle, limited time), then item-count tiers, then spend threshold, then cheapest-free, then gifts. Spend thresholds are measured before discounts, so a discount can't knock a buyer back under the threshold.
- **Price floors:** each product can have a floor; percentage discounts never go below it. Free mechanics (gift, cheapest free) are explicit creator choices and ignore the floor.
- **Gifts:** once per order. If the gift is already in the cart as a paid item, that line becomes free instead of adding a second copy. Pick-a-gift rules wait for the buyer's choice; offers that would unlock one count the most valuable option.
- **Never pre-selected.** The panel only suggests. Offers are sorted by extra saving (then lowest extra cost); three show and the rest sit behind See more. Skip is one click and can be undone.
- **The Pay button never moves.** On desktop the panel sits beside the order in the right column; on phones the Pay button lives in a fixed bar whose height doesn't change when savings appear.
- **Order bump** keeps its own special price and is never discounted further. **Bundles** already include their discount, so bundle orders skip deal paths. **Coupons** apply after deal paths.
- **Stats:** a view is counted once per checkout visit for each rule offered; a use when a paid order used the rule; revenue lift is the money from items the buyer added from the panel, split across the rules applied.

## Visual page editor (Part 4C)

- The **store home stays a fixed, proven layout** (sections and themes). The editor is for **extra pages**: a sale, an about page, a link-in-bio, a waitlist. They publish at `/s/<store>/p/<slug>` and appear in the store footer.
- **Data:** a page is a JSON tree validated by `lib/pages/schema.ts`. The root holds sections and heroes; sections hold content or a columns block; columns hold 2 to 4 columns. Every node has the same shape (props, style, layout, visibility, children), so moving is one operation, `moveNode(id, parentId, index)`, which is what drag and drop will call later.
- **One renderer** (`components/page-builder/renderer.tsx`) for the editor canvas, the versions preview and the live page. It sizes itself with container queries on the page, not the window, which is how the device switch shows the real phone layout inside a desktop editor.
- **No scripts, no HTML.** Text blocks take `**bold**`, `_italic_` and `[links](https://…)`, parsed into tokens. Links must start with `/`, `#`, `https://` or `mailto:`. YouTube or Vimeo links show a "Watch" card instead of an embedded player. Paste-HTML stays a separate sandboxed feature in Sales pages.
- **Constraints:** colours come from the theme palettes plus a short list; spacing, widths, heights, radii and shadows come from fixed scales; fonts come from the store's theme pairing.
- **Backgrounds:** solid, gradient, image, GIF or looping muted video, with overlay colour and strength, focal point and height. Video shows its poster on phones and for anyone who prefers reduced motion. A contrast warning appears when text may be hard to read (below 4.5:1, or a photo or video without a 35%+ overlay).
- **Uploads** are checked before saving (images and GIFs up to 5 MB, video up to 10 MB) and kept in the browser's IndexedDB in this frontend-only build. Pages refer to them as `asset:<id>`; with a backend, the upload returns a CDN URL instead.
- **Editing:** a zustand store per open page with an undo stack of document snapshots (100 steps; typing in one field is one step). The draft autosaves a moment after each change. Publish copies the draft to the live page and saves a version (20 kept). Discard resets the draft to what's live. Restore copies an old version into the draft, never straight to live.

## Quality (Part 5)

- **Touch targets follow the input device, not the screen width.** `pointer-coarse:` makes targets 44px on touch screens of any size (including tablets); mouse users keep the denser layout.
- **Long text never widens a page.** A zero-specificity base rule lets headings, paragraphs, links and table cells wrap anywhere, because creators type titles, emails and coupon codes as one long word. The stress data checks this on every list and card.
- **Type is in rem** with fluid heading sizes, so large system text scales everything. **Noto Sans** Devanagari, Tamil, Telugu and Kannada load only when a page contains those scripts.
- **Scroll areas that overflow become focusable regions**, so wide tables and code can be scrolled from the keyboard; they stay out of the tab order when everything fits.
- **Filter switches that look like tabs** (date ranges, review filters) are buttons with `aria-pressed` in a labelled group, because tabs without panels confuse screen readers.
- **Long lists are paged:** product reviews 10 at a time and the reviews inbox 20 at a time, because a product can have thousands.
- **Visual baselines** are recorded per platform (fonts rasterise differently), with a 0.1% tolerance. CI compares them on Windows, where they were recorded.

## Questions for the founder (Part 4)

1. **Who can reveal contact details?** Every admin can, with an optional reason. Should a reason be required, or should some roles need a second person to approve?
2. **Deal paths and coupons:** a coupon currently applies on top of deal-path prices. Should some coupons be blocked when a deal path is used?
3. **Price floors** exist in the data model, but there's no field in the product form yet. Add one there, or keep floors out of the UI for now?
4. **Visual pages and SEO:** pages have their own title and description. Should published pages go into the store's sitemap by default?
5. **Uploads:** 5 MB images and 10 MB videos, as specified. Video hosting gets expensive; should video backgrounds be a paid-plan feature?

# Part 6: media, AI images, several stores, plans, save bar, getting started

## Media (6A, 6B)

- **One uploader** (`components/media/media-uploader.tsx`) everywhere, including the page builder (through a thin adapter that keeps its plain `src` strings). Limits are shown before picking: JPG, PNG or WebP up to 5 MB, GIF up to 5 MB, MP4 or WebM up to 10 MB. Errors name the file and say what to do.
- **Uploads are mocked** in `lib/api/media.ts`: progress in ten steps, then the file is kept in this browser's IndexedDB as `asset:<id>`. WebKit sometimes refuses to keep a Blob in IndexedDB, so the store falls back to raw bytes. A backend upload returns a CDN URL instead; nothing else changes.
- **Every upload goes into the library** (`/media`), which shows where each file is used across all of the creator's stores. Deleting a used file asks first and leaves an empty placeholder where it was.
- **Products:** up to 8 images and 1 video, reordered with up and down buttons (no drag and drop, so it works the same with a keyboard and on phones). The first image is the cover.
- **Backgrounds** are colour or image (the hero also takes a looping muted video with a poster). The contrast check samples the picture's average colour and offers the smallest overlay that makes text readable. Phones and reduced-motion users see the poster. Visual pages also have a page-level background behind every section.
- **Review photos** are buyers' own uploads, so they're checked against the same limits but kept out of the creator's library.

## AI images (6E)

- Every screen calls `generateImage()` and `transformImage()` in `lib/api/ai.ts`. The mock draws pictures on a canvas after a 3 to 6 second wait. A real provider replaces the bodies of those two functions; no provider is named in the UI or the code.
- **Credits:** 1 per generation (4 variations) or per edit. Free gets 10 a month and Pro 200, set in `lib/plans.ts`. Running out opens the Upgrade dialog.
- **Safety:** a note under the prompt about real brands, logos and people, and **Report image** on every result, which hides it from history.

## Several stores (6C)

- The mock keeps the active store in the top-level fields and the others in `ownedStores`. Switching swaps them, so every existing API works unchanged. A backend scopes each request by store id instead.
- About, FAQ and policies belong to one store each. New stores get default text marked **Not edited yet** until it's saved once.

## Plans (6D)

- **Free:** 1 store, 1 product, 10 AI credits a month, $0. **Pro:** no store or product limit, 200 AI credits, $20 a month with the first month free. **Both pay the same 3% per sale.**
- Limits are checked in the API (`LimitError`, code `limit`) and before navigating (`GuardedLink`, `plan.guard`). Either way the creator sees the Upgrade dialog, never a disabled button with no explanation.
- **Over the limit after a downgrade:** nothing is deleted or hidden; only creating more is blocked.

## Save bar (6F)

- `useDirtyForm` compares what's on screen with the last saved values, so changing something back hides the bar. `useFormSaveBar` adapts it to react-hook-form.
- The bar sits above the tab bar on phones and at the top right of its card on larger screens. On phones, toasts move to the top so they never cover it.
- Leaving with unsaved changes: in-app links ask first ("Leave without saving?"); refresh and closing the tab use the browser's own warning.
- Sheets for new items (a new coupon, collection or SKU) keep a single **Add** button; the save bar is for changing something that already exists.
- The visual page editor keeps its autosave. **Publish** shows only when the draft differs from the live page; otherwise it says **Live**.

## Getting started (6G)

- Ten steps; business details and analytics are optional. States are worked out from real data (a product exists, a payout method exists, the store is live) plus a few flags the data can't show (email verified, link shared, a coach mark seen). The flags are kept per account in local storage, so progress resumes after logging out.
- The sample store predates the tracker, so it starts fully set up.
- **Next step** links carry `?coach=<step>`; the coach mark points at the exact control and is never shown again for a finished step or after **Skip tour**.

## Questions for the founder (Part 6)

1. **Free plan:** is 1 product right, or would 3 let creators try bundles and deal paths before paying?
2. **AI credits:** 10 and 200 a month are placeholders. What does a generation cost with the chosen provider?
3. **Video backgrounds** are on both plans. Should they be Pro-only, given hosting costs?
4. **Downgrades:** a creator with 5 products who drops to Free keeps selling all 5 and can't add more. Is that the policy, or should extra products be unpublished?
