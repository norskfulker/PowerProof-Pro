# Decisions and open questions

Small calls made while building the frontend, so the founder can check them in one place. Everything here is easy to change.

## How we work on this codebase

- **Look before you create.** Before adding a file, component, table or column, find the folder, component or table that already does the job and change that. Create something new only when nothing existing fits, and say why. This applies to code (`components/`, `lib/api/`, `lib/nav/config.ts`, one shared component per idea such as `ColorModeToggle`, `StatusTabs`, `BrandColorPicker`) and to the database (check `supabase/migrations/` and the live schema first; extend an existing table or constraint before adding a new one).
- **Database changes go in a numbered file in `supabase/migrations/`** and are applied to the project; the file is the record.

## Stack

| Choice | Why |
| --- | --- |
| Next.js 16.3 (App Router), React 19, TypeScript | Latest stable at build time. Deploys to Cloudflare Workers through the OpenNext adapter (see "Hosting on Cloudflare Workers" at the end). |
| Tailwind CSS v4 with tokens in `app/globals.css` | v4 is what `create-next-app` ships. Tokens are CSS variables mapped through `@theme`. |
| shadcn/ui, new-york style, Radix primitives | As specified. Components live in `components/ui` and are restyled in place. The shadcn CLI wrote `import { cn } from "cn"` (an unrelated npm package) into every component; I fixed the imports and removed that package. |
| TanStack Table **v8** | v9 shipped with a different API. v8 is stable and documented. |
| zod 3 + react-hook-form | zod 3 is what `@hookform/resolvers` pairs with here. |
| Recharts 3 | Charts read colours from CSS variables (`var(--chart-1)` etc.). |
| React Email | Templates in `/emails`, rendered in the browser at `/emails/*`. |

## Data layer

- **Pages only import `@/lib/api`.** Every function there reads and writes Supabase (`lib/api/live/*` holds the queries and the row to app-type mapping). There is no other backend, no mock and no switch to turn one on: if the Supabase variables are missing the app says so.
- **Types live in `lib/types/`** (one file per area, re-exported from `index.ts`).
- **Pages fetch through the `useApi` hook**, so loading skeletons and error states with retry are real. A change in one tab tells other tabs to re-read through a `storage` event.
- **Sign up creates a new, empty store.** Nothing is pre-filled.
- **Nothing is made up.** A list with nothing in it shows an empty state with one next step; a figure with no source (visitors, conversion, sources, funnels, deal usage) shows "No data yet"; a feature that needs a server we don't have shows "Coming soon".
- **No test data in the app.** App code can't import fixtures (ESLint rule). The `tests/` suites (fixtures, end-to-end, integration) were dropped in Oct 2026 at the founder's request; unit tests sit next to their code.
- **Admin console** is connected (see "The founder console" below).

## Money

- Money is always `{ amount: integer minor units, currency }`. `MoneyText` and `formatMoney` are the only formatters. INR uses Indian digit grouping (₹1,52,400.00).
- **The creator's country decides the store's currency** (`stores.country`, `lib/countries.ts`; INR, USD, EUR, GBP, AED, SGD, AUD, CAD). Prices are set in that currency. Both are chosen once at sign-up and locked once there are products (`store_currency_locked`); the database also forces every product into its store's currency.
- **Prices show in the store's own currency, and buyers can view them in another when rates exist.** Rates live in `fx_rates` (units per US dollar, readable by everyone, writable only by PowerProof staff). With no rates the "Show prices in" picker doesn't appear and nothing is guessed. Conversion is display only: checkout charges the store's currency. No rate source is connected, so the table starts empty.
- **Fees:** 3% platform plus about 2% gateway, both worked out on the INR price. Subscription is $20/month after a free first month; the calculator shows it in dollars rather than converting it at an invented rate.
- **Settlement:** each sale is held 3 hours (the ledger's `available_at`), then available. Withdrawals call the database's `request_payout`.
- **Withdrawals:** minimum ₹100.00, no fee. Payout methods: up to 5 bank accounts (in the company's or the director's name; the database checks the name), up to 5 UPI IDs and up to 5 crypto wallets (USDT, USDC, BTC or ETH on the network you pick). What a crypto payout is worth depends on the rate when it is sent, so no rate is shown.

## Product and content

- **A product is digital or physical, picked first (`/catalog/products/new`).** The steps are the same; a physical product has no file step and must be in a collection. Many at once: `/catalog/products/import` takes a CSV in the format we give (`lib/products-csv.ts`); everything arrives as drafts and each row is checked with the product form's own rules.
- **Edit screens autosave** (`useDirtyForm`, 1.2 s after the last edit; the bar becomes a small "Saving… / All changes saved" status; a pending save is sent when you leave). Screens where someone creates something and presses a button keep Save/Create: the first product, bank accounts, passwords, collections, offers and SKUs.
- **A section's on/off is one setting** (`design.sections[].enabled`): the switch in the section list and the one inside the section's own panel are the same thing.
- **Custom fonts** are uploaded to the store's media folder (checked by extension and first bytes, 2 MB) and loaded with @font-face wherever the store's theme applies; `theme.customFont` chooses headings, text or both.
- **Lead pages:** `lead_form` and `booking` blocks plus the Lead generation, Squeeze, Book a call and Click-through templates. Visitors write only through `submit_lead` (store and page must be live; double clicks and floods are ignored; a time can be booked once). The creator reads them in Sales › Leads. A page's focus mode hides the store menu and footer. Newsletter signups and the store's contact form are leads of their own kinds.
- **The marketplace** (`/marketplace`) lives inside the creator app and needs sign-in (the page, and the database function too: anonymous callers can't run it). It lists **deals** that creators list from their own live products (Catalog › Marketplace deals): one-time or subscription, original price and deal price, one deal per product. Saving a deal sets the product to those prices so checkout charges what the card shows. Buyers read through one function, `marketplace_deals`, with filters (digital/physical, payment, category, price, badge) and sorts. **Verified** is set by PowerProof staff (`verified_at`, which creators can't write). **Trusted seller** is worked out from orders: at least 5 paid, refunds at most 5%, reviews at least 4 stars. Each deal carries its seller's country (flag, and a country filter), and prices can be viewed in the viewer's own currency when `fx_rates` has rows (display only). Revenue (total and 30 days) comes from paid orders and is shown only when the creator leaves "Show what this product earns" on. Units sold, and revenue when shared, are visible to signed-in creators only. Staff verify in Admin › Moderation › Marketplace deals.
- **Making a product live is an explicit button** in four places: "Make it live" in the draft notice on the product form, "Create and make it live" (or "Save as draft") at the end of the first-product steps, "Make it live" / "Move to drafts" in the products list menu, and per product (and "Make every ready product live") in the checklist after an import. Going live needs a file (digital) or a collection (physical); `publishProduct` says which is missing. Pictures and a type are advice only.
- **Drafts always say so in words** ("Draft: not visible to buyers", with what's still needed: `components/products/readiness.ts`) in the product list, the product form and after an import. Save and Discard sit at the top of the product form.
- **A creator's first product is three steps** (the basics, images and files, price and publish), shown by the same `ProductForm` with `wizard`; after that it is the full form. Onboarding is a name and a country, then straight to that first product.
- **Sidebar groups only open and close.** They have no page of their own; items nested under them are drawn as a tree.
- **Live orders sit inside Analytics** on the dashboard and appear once a product is live. Charts with no data stay as empty charts.
- **One way to add a digital product for now:** upload a file (`/products/new/upload?type=digital`). The old mock "import from a link" and product sales pages were removed (links are now read for real under Import a store › Paste a link); the visual page editor (Store › Design › Pages) replaces sales pages.
- **A product needs a file before it can be published.** The schema enforces this in the editor and in onboarding.
- **Upload limit shown as 2 GB per file.** Confirm against the storage plan.
- **Product covers are generated art** (`CoverArt`). Six layouts drawn the same way in HTML and on canvas, so the image maker's PNG export matches what the store shows. Uploaded images are public files in Supabase Storage.
- **Store URLs** are shown as `powerproof.store/<slug>`; in this app they live at `/s/<slug>`.

## Checkout and payments

- **Not open yet.** Checkout, the order page, downloads, invoices and order lookup need Razorpay and server routes. Their screens say "opens soon", and **Buy now** on a store says checkout isn't open. There is no pretend gateway.
- PowerProof will never render card fields: payment happens on the gateway's own checkout.
- Buyers won't need an account. Order lookup by email will live at `/lookup`.

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

The gateway integration and webhooks, real email sending, `embed.js`, the AI image maker, analytics ingestion (visitor, conversion and source figures show "No data yet"), GA/Clarity script injection on buyer pages.

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
- **Custom domains:** see "Custom domains, finished" below. Stores live at `/s/[store]`, and on their own domain once one is connected.

## Store design (one Shopify-style editor for the home page and every other page)

- **Oct 2026: the store home is a page like any other.** It is a `custom_pages` row with slug `home` and template `home`, edited in the store editor at `/store/[id]/design/pages/home/edit` (Base design redirects there). The row is made on first open by converting the old section layout (`homeDocFrom` in `lib/pages/templates.ts`), keeping section ids so `#section-<id>` links still work. Until a creator publishes it, the storefront shows the same conversion of their old layout, so nothing changes for buyers by surprise.
- **Drafts are private** (migration 031): `custom_pages.layout` is public once a page is published, so it holds only what buyers see (template, published version, SEO). The working draft, versions and the home page's unpublished theme live in `custom_page_drafts`, owner-only. The home page doesn't count toward the plan's page limit.
- **Draft and Publish for everything.** Page edits autosave as a draft; store-wide settings (theme, colour schemes, header, announcement, footer, logo) are drafted with the home page's draft (`site`) and only go to `stores.theme`, `brand_color` and `logo_url` on Publish. Undo covers both. Publishing the home page of a hidden store also makes it live.
- **The editor** (`components/page-builder`): left sidebar with the section tree (Header group, the page's sections and blocks, Footer group; drag, arrows, show/hide, Add section from presets, Add block) and a Theme tab; the page in the middle inside an iframe (a React portal, so media queries match the device switch) with the real header and footer, click-to-select, text typed straight onto the page and "Add section" lines between sections; settings for the selection on the right.
- **The editor lives in the app** (sidebar, top bar and the Store tabs stay). The app menu starts as icons there to leave room, and the editor picks its layout from its own width: three columns, two (settings move into an Edit tab that opens on selection), or the phone layout.
- **Icons** come from a curated set of about 150 Phosphor icons (`components/pp/icon-library.tsx`, stored by name, older short names still work). Click an icon on the page to change it; highlights and cards also choose the icon style (thin to filled, or two-tone).
- **Backgrounds cover the whole width or only the content area** (`layout.fill`). New sections and converted home sections use the content area, so a colour or scheme sits on a panel instead of across the page. A section's own colour, gradient or picture sets readable text, card, border and button colours for everything in it.
- **Build with AI** (Oct 2026): the creator picks one of the page types (home, launch, sale, link in bio, lead, squeeze, booking, click-through, custom), describes it, and Gemini (`GEMINI_API_KEY`, model `gemini-3.8-flash` unless `GEMINI_MODEL` says otherwise; Claude was dropped in Oct 2026 at the user's request) builds it section by section on the canvas, in the language they prefer, optionally designing the theme too. Each section is one strict tool call (the page tree is recursive, which tool schemas can't describe) checked against the store before it shows: real products and product pictures only, store links only, real reviews only. The result is kept as one undo step and saved as a version ("AI draft"); publishing stays the creator's click. `/api/ai/page` holds the keys and checks ownership. `start_ai_page` checks and records the daily allowance (`plan_limits.ai_pages_daily`: Free 1, Pro 10, India's day; failed runs don't count; runs are `running` until `finish_ai_page`, migration 033).
- **AI sees the store's media** (Oct 2026): every live product's pictures and video, and the media library, are listed for the AI as `pic:<n>` / `vid:<n>` (product covers stay `product:<id>` so they follow the product); up to 12 pictures are also attached so Gemini can look at them and say their shape. It can use them in pictures, galleries, videos, image-with-text, logo marquees and section backgrounds (with an overlay floor so words stay readable), plus per-block alignment, columns (now with top/middle/bottom alignment), heights and gaps. A last design pass sizes grids to what they hold (one product becomes a product card), widens crowded sections, keeps reading text a comfortable width and lines a section up left when a heading carries a "View all" link.
- **Store data beside the page** (Oct 2026): the store editor has an icon rail: Sections, Pages, Theme, About and FAQ, Reviews, Questions. Pages, About, FAQ, reviews and questions moved there from their own screens (old addresses redirect to `…/edit?panel=…`); the Store tabs are Design, Policies, Offers and SEO. About and FAQ edits show on the canvas as you type; hiding a review takes it off the preview.
- **Header and footer links in the editor** don't navigate: they say where the link goes and offer to open that page's editor (About, FAQ, policies, contact, products, collections, other pages, or a section on this page).
- **Colour schemes** (`StoreTheme.schemes`, like Shopify's): named schemes, each with light and dark colours (background, text, button, button label, border). Five are made from the palette and brand colour until the creator edits one. A section, the header or the footer picks a scheme by id; `schemeCss` turns each into tokens under `[data-store-mode]`, so every component inside follows. Sections can still set their own background on top.
- **Themes are token overrides scoped to the store root** (`lib/store-themes.ts`, `StoreThemeScope`). Six palettes, an optional accent colour (soft/strong/ink variants are derived with `color-mix`), three font pairings, and colour schemes. Because components read tokens, every store component works in every theme with no per-theme code.
- **Font pairings:** Modern (Bricolage Grotesque + Hanken Grotesk), Editorial (Fraunces + Hanken Grotesk), Clean (Space Grotesk + IBM Plex Sans). All self-hosted through `next/font`.
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
- Creators can **reply once** (labelled Creator) and **pin up to 3** (`reviews.pinned`). Only PowerProof can hide a review. They cannot edit stars or text. Helpful votes and imported testimonials were removed: nothing stored them.
- **Reports** from reviews and questions go to the `reports` table (`report_content`, open to visitors, only for things they could see, de-duplicated per person and capped per item) and show in Admin › Moderation › Flags. Taking one down hides the review or question, archives a product, or suspends a store; dismissing closes the report.
- **Questions:** anyone can ask with name and email (only the first name is shown). The creator answers from `/store/questions`; verified buyers can answer from their order page. Answers are one level deep. The "question answered" email is previewed at `/emails/question-answered`.

## Questions for the founder (store)

1. **Phone at checkout:** required, as specified. That adds friction for international buyers; keep it required for them too?
2. **One coupon per order:** OK, or should coupons stack with deals? Right now a coupon applies on top of deal prices.
3. **Review request timing:** the email says 5 days after purchase. Right number?
4. **Order bump pricing:** the add-on price is set by the creator with no floor. Should PowerProof enforce a minimum?
5. **"Powered by PowerProof"** is shown on every store. The setting exists (`showPoweredBy`) but there's no toggle until the paid-plan rule is decided.

## Global search (Part 4A)

- **One index, two scopes.** `lib/api/search.ts` builds one list of searchable records. The founder admin searches every store; creators search only their own (same palette, fewer types, no masking).
- **Patterns:** `#1042` / `PP-1042` / a bare 3 to 6 digit number is an order number; anything with `@` is an email; `+91 98…` or 7+ digits is a phone; `@slug` limits to one store (`@store-name planner`); `INV-` is an invoice. Everything else is matched word by word.
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

- The editor serves the **home page** (see Store design) and **extra pages**: a sale, an about page, a link-in-bio, a waitlist. Extra pages publish at `/s/<store>/p/<slug>` and appear in the store footer.
- **Data:** a page is a JSON tree validated by `lib/pages/schema.ts`. The root holds sections and heroes; sections hold content or a columns block; columns hold 2 to 4 columns. Every node has the same shape (props, style, layout, visibility, children), so moving is one operation, `moveNode(id, parentId, index)`, which is what drag and drop will call later.
- **One renderer** (`components/page-builder/renderer.tsx`) for the editor canvas, the versions preview and the live page. It sizes itself with container queries on the page, not the window, which is how the device switch shows the real phone layout inside a desktop editor.
- **No scripts, no HTML.** Text blocks take `**bold**`, `_italic_` and `[links](https://…)`, parsed into tokens. Links must start with `/`, `#`, `https://` or `mailto:`. YouTube and Vimeo links play in youtube-nocookie and Vimeo's player; any other link shows a "Watch" card. Paste-HTML stays a separate sandboxed feature in Sales pages.
- **Constraints:** colours come from the theme's schemes, palette swatches or a free picker (with contrast warnings); spacing, widths, heights, radii and shadows come from fixed scales; fonts come from the store's theme pairing.
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
- **Uploads go to Supabase Storage** (`store-media/<store id>/…`) and the library list is read from the bucket. Nothing about the library is kept in the browser.
- **Every upload goes into the library** (`/media`), which shows where each file is used across all of the creator's stores. Deleting a used file asks first and leaves an empty placeholder where it was.
- **Products:** up to 8 images and 1 video, reordered with up and down buttons (no drag and drop, so it works the same with a keyboard and on phones). The first image is the cover.
- **Backgrounds** are colour or image (the hero also takes a looping muted video with a poster). The contrast check samples the picture's average colour and offers the smallest overlay that makes text readable. Phones and reduced-motion users see the poster. Visual pages also have a page-level background behind every section.
- **Review photos** are buyers' own uploads, so they're checked against the same limits but kept out of the creator's library.

## AI images (6E)

- **Coming soon.** The image maker only ever drew pictures in the browser; with no image service connected it was removed and `/tools/ai-images` says so.
- **Credits:** 1 per generation (4 variations) or per edit. Free gets 10 a month and Pro 200, set in `lib/plans.ts`. Running out opens the Upgrade dialog.
- **Safety:** a note under the prompt about real brands, logos and people, and **Report image** on every result, which hides it from history.

## Several stores (6C)

- Each request is scoped by store id; the chosen store is remembered in the browser as a preference.
- About, FAQ and policies belong to one store each. New stores get default text marked **Not edited yet** until it's saved once.

## Plans (6D)

- **Free:** 1 store, 10 products, 3 pages, 10 AI credits a month, $0. **Pro:** no store, product or page limit, 200 AI credits, $20 a month with the first month free. **Both pay the same 3% per sale.**
- Limits are checked in the API (`LimitError`, code `limit`) and before navigating (`GuardedLink`, `plan.guard`). Either way the creator sees the Upgrade dialog, never a disabled button with no explanation.
- **Over the limit after a downgrade:** nothing is deleted or hidden; only creating more is blocked.

## Save bar (6F)

- `useDirtyForm` compares what's on screen with the last saved values, so changing something back hides the bar. `useFormSaveBar` adapts it to react-hook-form.
- The bar sits above the tab bar on phones and at the top right of its card on larger screens. On phones, toasts move to the top so they never cover it.
- Leaving with unsaved changes: in-app links ask first ("Leave without saving?"); refresh and closing the tab use the browser's own warning.
- Sheets for new items (a new coupon, collection or SKU) keep a single **Add** button; the save bar is for changing something that already exists.
- The visual page editor keeps its autosave. **Publish** shows only when the draft differs from the live page; otherwise it says **Live**.

## Getting started (6G)

- Ten steps; business details and analytics are optional. States are worked out from real data (a product exists, a payout method exists, the store is live) plus a few flags the data can't show (email verified, link shared, a coach mark seen). The flags are saved to `profiles.onboarding`, so progress resumes after logging out.
- **Next step** links carry `?coach=<step>`; the coach mark points at the exact control and is never shown again for a finished step or after **Skip tour**.

## Questions for the founder (Part 6)

1. **Free plan:** is 1 product right, or would 3 let creators try bundles and deal paths before paying?
2. **AI credits:** 10 and 200 a month are placeholders. What does a generation cost with the chosen provider?
3. **Video backgrounds** are on both plans. Should they be Pro-only, given hosting costs?
4. **Downgrades:** a creator with 5 products who drops to Free keeps selling all 5 and can't add more. Is that the policy, or should extra products be unpublished?

# Part 7: light and dark, custom domains, nested navigation

## Light and dark (7A)

- **One token set per theme** in `app/globals.css`: `:root` (and `[data-theme="light"]`) for light, `[data-theme="dark"]` for dark. Components still never hold colours; the few new needs became tokens: `--inverse` (code editor and video placeholders, dark in both themes), `--scrim` (behind dialogs), `--toast-*`, `--sidebar-admin-foreground`.
- **Dark values start from the brief** (`#0A1412` background, `#101D1A` surface, `#EAF0ED` text, `#93A39D` muted, `#1F322D` border, brass `#C9A24F`, button text `#06100D`). **One change:** primary is `#3AA584`, not `#2E8B6F`. `#2E8B6F` passes for button text but is only 4.2:1 as link text on the dark surface, and links use the same colour.
- **Every pair is tested.** `lib/theme.test.ts` reads both token blocks from the CSS file and checks text, status, border and button pairs at 4.5:1 (3:1 for borders), plus all six store palettes in both modes. The check also caught a light-mode bug: form borders were 2.9:1, now `#85918B` (3.3:1).
- **Shadows become borders in dark** (`--shadow-pop` is a 1px border-strong ring). Photos and video posters dim to 88% in dark through `.dim-media`; generated covers don't, because they're already designed colour.
- **No flash:** a tiny inline script in `<head>` reads `pp:theme` (light, dark, or nothing for System) and sets `data-theme` before paint. `lib/api` has `getThemePref` / `setThemePref`, so moving the choice to the account later only changes those bodies.
- **Stores:** each palette has a dark version (primary lifted so it reads as text). The creator picks Light, Dark or Auto; Auto follows each buyer's device. A buyer's footer choice is remembered per store in this browser and wins over the default. Custom accents get their text colour from contrast, in both modes.
- **Stay light:** email previews and the invoice document set `data-theme="light"`; printing forces white paper.

## Custom domains (7B)

- Built since: see "Custom domains, finished" at the end of this file. `lib/api/domains.ts` keeps the provider guides, DNS targets, problem explanations and hostname checks the screen shows.

## Navigation (7C)

- **One config** (`lib/nav/config.ts`) drives the sidebar, the phone drawer and tabs, breadcrumbs, command palette results and empty-state links (`navHref`). Live counts, collections and Pro locks are filled in by `lib/nav/model.ts` from `getNavCounts()`.
- **Routes follow the tree.** Store screens live under `/store/[id]/…` and switch the active store to match the URL. Screens that don't know the id link to `/store/current/…`, which becomes the real id on arrival. Every old address redirects (`next.config.ts`).
- **Tabs that are routes:** store design sections, offer types and payout sections are URL segments, so the menu, breadcrumbs and back button agree. Settings pages use `?tab=` tabs; hidden tabs stay mounted so unsaved changes still trigger the leave warning.
- **Two placements beyond the brief:** **Store settings** (name, logo, colours, support email) sits under Store, because those belong to one store. **Sales pages** sit under Catalog, because each one sells a product.
- **Accessibility:** the sidebar is a WAI-ARIA tree with a roving tab stop. Up/Down move, Right opens or steps in, Left closes or steps out, Home/End jump, Enter opens.
- **Pro locks:** items like Domain show a lock on Free and open the Upgrade dialog instead of navigating. The domain page is still reachable from Store settings and onboarding, so Free creators can see what a domain involves.

## Questions for the founder (Part 7)

1. **Default theme:** System follows the device. Should the creator app default to Light until people opt in?
2. **One-click domains:** which DNS hosts will we actually partner with? The UI only promises one click for those.
3. **Locked menu items:** should Free creators be able to open Pro screens to look around (with the Upgrade prompt inside), rather than getting the dialog straight from the menu?

# Backend: Supabase (stage 1)

## How the app reaches the database

- **`/lib/api` is the only door, and it only talks to Supabase** (`lib/api/live/*`). There is no mock backend and no `NEXT_PUBLIC_BACKEND` switch.
- **Clients:** `lib/supabase/browser.ts` (anon key + session cookie), `server.ts` (same, for server code), `admin.ts` (service role). The service-role client imports `server-only`, and ESLint blocks it in client code.
- **Route guard:** `proxy.ts` (Next 16's name for middleware) refreshes the session and sends signed-out visitors on creator and admin screens to `/login`; `/admin` also needs `app_metadata.role = "admin"`. RLS is still what protects the data.
- **Plan limits** are read from `plan_limits` (pricing page, Upgrade dialog, comparison table, AI credits). Creates aren't pre-checked: the database refuses, and the Upgrade dialog opens on that error.

## Field mapping

- Product status `published` is `live` in the database. "Notion kit" is stored as `template` until the database has a `notion` type.
- Generated covers (a template and colours, drawn in the browser) are kept in `product_media.url` as `cover:<json>`, so the gallery order survives. Real images are https URLs in `store-media`.
- `stores.theme` holds the store design; `theme_mode` mirrors its light/dark default. About, FAQ (`{ items, contactNote }`) and policies (`{ text }`) live in `store_pages`; pages nobody has edited show the app's default text.
- The company address is stored as six lines in `stores.company_address`: address 1, address 2, city, state, PIN code, country.
- Coupons: percent values are basis points; a code covers the whole store or one product.
- Deal paths: only **bundle discount** (percent off when every trigger product is in the cart) and **free gift** (unlocked by products, no minimum spend) exist in `deal_rules`. The other kinds say "coming soon". Bundles are bundle-discount deal paths.
- Sales screens (orders, customers, dashboard, analytics) read orders, order lines and the ledger. Visits aren't tracked yet, so visitor, conversion and source figures show nothing instead of estimates.
- Proceeds are held 3 hours, then withdrawable any time; all copy says so.

## Not in the database yet (no browser storage added for them)

- Coming soon on the live backend: analytics integrations, limited-time store-wide sales, imported testimonials, renaming library files.
- The media library lists the store's Storage folder (`store-media/<store id>/media` and `/ai`).
- Still in the browser until their migration lands: the visual page builder and sales pages, review pins, SKUs and tax codes, PAN and business type.

## Accepted Supabase advisor findings

Run the security advisors after every database change. These findings are expected:

- **RLS enabled, no policy:** `download_tokens`, `webhook_events` (server-only on purpose).
- **Callable without signing in (SECURITY DEFINER):** `store_is_public`, `product_is_public`, `validate_coupon`, `resolve_domain`.
- **Callable by signed-in users (SECURITY DEFINER), each checking admin or ownership inside:** `admin_search`, `admin_reveal_buyer_phone`, `ai_credits_remaining`, `request_payout`, `is_store_owner`, `is_product_owner`, plus the four public helpers above.

Anything else is new and needs a look before release.


## Selling, email, domains and analytics

- **Checkout is server-priced.** The browser sends which products and which code; `lib/server/checkout.ts` prices the order from the database with the same deal engine the storefront uses, then `create_order` writes it. An order is only marked paid by Razorpay's signed proof (`/api/checkout/verify`) or its webhook (`/api/webhooks/razorpay`, de-duplicated through `webhook_events`); both call `apply_payment`, which is safe to repeat and writes the ledger. Free orders skip the gateway.
- **Buyers and visitors talk to the database directly.** The browser calls database functions that check everything themselves (`validate_coupon`, `get_order`, `lookup_order`, `submit_review`, `ask_question`, `submit_lead`, `track_event`, `booked_slots`) instead of custom web routes. The discount code is checked live as the buyer types: the deal paths are read from the database, `validate_coupon` says what the code takes off, and the panel shows the total (`lib/api/checkout.ts`). That number is for display; the price actually charged is set again on the server when the payment is created.
- **Buyers have no accounts.** A paid order gives a secret link (`/order/<token>`, 30 days, hashed in `download_tokens`). Lost it? `/lookup` takes the email on the order plus its number and issues a fresh one, with the same answer for every miss. Downloads are counted and each hands out a 60-second private link.
- **Refunds** go back to the original payment method, reverse the ledger (the platform returns its fee; the creator gives back the rest, since the card fee isn't refunded) and stop downloads. Full refunds only.
- **Invoices** are worked out from what was charged (`lib/invoice-view.ts`): a seller with a GSTIN charges IGST to India, nil to exports; no GSTIN, no tax. Still to be confirmed with a CA.
- **Reviews** come from the order page: the link proves the purchase, one per product per order. Questions are open to anyone, rate limited.
- **Only work that needs a secret key is a server route:** creating and confirming a Razorpay payment and its webhook, private download links, refunds, receipt emails, and attaching a domain. Email is Resend over HTTPS (`lib/server/email.ts`); nothing claims an email went out when it didn't. Lead, booking and contact notices to the store are not emailed yet (they show under Sales › Leads).
- **Custom domains** use the existing `domains` table and `resolve_domain()`; the server adds the domain as a Cloudflare for SaaS custom hostname, shows the DNS records, re-checks every 30 seconds, and the proxy serves an active domain's store from `/s/<store>`.
- **Analytics:** the storefront counts visits itself (`track_event`, cookieless, Do Not Track respected) for the dashboard; Google Analytics and Clarity load only after the visitor agrees.

## The founder console

- **Who is an admin:** `app_metadata.role = 'admin'` on the Supabase user (set in the dashboard; users can't edit it). It is read from the sign-in token, so a new admin signs out and in once. `proxy.ts` keeps everyone else out of `/admin`, and every database function below checks `is_admin()` again.
- **Every screen goes through a database function** (`lib/api/admin.ts`): `admin_overview`, `admin_counts`, `admin_creators`, `admin_stores`, `admin_orders`, `admin_payouts`, `admin_refunds`, `admin_disputes`, `admin_content`, `admin_reports`, `admin_deals`, `admin_audit`, `admin_search`. Lists mask buyer emails; a buyer's phone needs a written reason (`admin_reveal_buyer_phone`). Money is shown per currency and never added across currencies.
- **Every change is audited** (`audit_log`, who, what, which item, why): suspend or lift a store (`admin_set_store_status`; lifting returns the store to the status it had before; a seller can't lift a suspension, enforced by a trigger), hide or show a review or question (`admin_moderate`), close a report (`admin_resolve_report`), verify a deal (`admin_verify_deal`), move a payout (`admin_set_payout`), refund an order (the existing refund route also accepts staff, then logs it).
- **Payouts are worked by hand.** A seller's request lands in Admin › Money › Payouts; staff send the money from the bank, then mark it paid with the bank reference, or failed with a reason (the amount goes back to the seller through `settle_payout`). Automatic payouts need a payout provider and are not built.
- **Disputes** (`disputes`) are filled by Razorpay's `payment.dispute.*` webhooks (`record_dispute`) and shown to staff, and to the seller under Sales › Orders › Disputed. Evidence is submitted in the Razorpay dashboard (linked from each row). A lost dispute does not yet change the ledger.
- Migrations 028 and 029.
- **Time ranges and activity (migration 030).** The overview takes 3, 7 or 30 days and compares with the same length before. Creators are counted active when they open the app (`touch_activity`, on open and every 3 minutes while the tab is visible; `activity_days`, `profiles.last_seen_at`). Store visitors are browser sessions from `store_events`, so one person on two devices counts twice. "Online now" is anything in the last 5 minutes, refreshed every 15 seconds. Activity counts start from the day this was deployed.
- **Payouts through RazorpayX.** A seller's bank account is registered with Razorpay when they add it (`/api/payouts/methods`; the full number goes to Razorpay and is never stored, we keep the last four and the fund-account id). Staff press "Send with Razorpay" (`/api/payouts/[id]/send`): the amount goes out in rupees by IMPS/UPI (NEFT above ₹5,00,000), the payout id is the idempotency key, and Razorpay's `payout.*` webhooks close it (`settle_payout_by_gateway`). A payout returned after being marked paid is flagged in the webhook log for a person.
- **Currency follows the seller's rail** (`lib/payout-plan.ts`): an Indian bank or UPI id is rupees, so a dollar balance is converted at the stored rate (`fx_rates`, refreshed daily from a public feed or by hand). Non-Indian sellers and crypto stay in the by-hand queue with the amount already worked out in their country's currency. Razorpay's Payout API documentation we could find only covers rupee payouts; "global payouts" is a separate product that has to be enabled with Razorpay, so it is not wired.
- **Admin access is granted outside the app** (Supabase dashboard); the Team page only lists admins.


- **Physical products** (Oct 2026): variants (up to 3 options, 100 combinations, each with its own price, SKU and stock), stock counting, flat-rate shipping by zone (free over an amount), cash on delivery (India, physical-only orders, optional fee and order cap) and GST on shipping at the main item's rate (one composite supply). Stock is taken when an online order is paid or a COD order is placed, never below zero, and given back when a COD order is cancelled or an unsent order is refunded. COD: the creator collects the cash and marks it; the order then gets its invoice and PowerProof's fee is taken from the creator's balance (`adjustment`), returned on refund. Deals work per product on one unit and apply per unit; a free unit (gift, cheapest-free) is one unit. Invoices: shipping is its own line; CGST/SGST when the delivery state is the seller's, IGST otherwise; exports say goods or services. Migrations 034–035. Found on the way: coupon uses were counted twice (trigger and checkout code); the code's count was removed.
- **Store import** (Oct 2026): Catalog › Import a store brings products (pictures copied into the store's media, variants, stock, collections), past orders (as history: no ledger, no PowerProof invoice) and marketing-consented customers (as newsletter subscribers) from Shopify (OAuth, Admin API 2026-10), WooCommerce (read-only REST key, not stored), Amazon (the seller's All Listings Report), Etsy (listings CSV), Gumroad (token) or a website (Shopify/WooCommerce public data, or schema.org product data). Ownership is required and recorded (`store_imports.proof`). Someone else's store only with its owner's approval: the request goes to an address published on that site, never one the requester types, and the decision is logged (`copy_requests`). Marketplaces (Amazon, Etsy, Flipkart…) can't be copied that way. Website fetching is SSRF-guarded. Products are created through the normal product calls, so plan limits apply. Migration 036. Needs `IMPORT_SECRET`, and for Shopify a Partner app (`SHOPIFY_CLIENT_ID`/`SECRET`); customer and order data from Shopify need Shopify's protected-customer-data approval.
- **Add from a link** (Oct 2026; on Products as "From a link", on Add a product, and in the empty state; `components/products/link-import.tsx`). The separate Import a store page and its Shopify (OAuth), WooCommerce (REST key), Amazon/Etsy (seller files), Gumroad, verified-website and owner-approval sources were removed, code included (`/catalog/import` redirects to `/catalog/products?link=1`). What's left: `/api/import/preview` (links only), `/api/import/media`, `lib/server/import/{link,sources,auth}.ts`. Migration 037 dropped the database objects only those used (`import_connections`, `copy_requests`, `import_history()`, `orders.imported_from/import_ref`, and that column in `creator_orders`); all were empty. `store_imports` stays and records each link read. A link: any product page or shop address (Amazon, Flipkart, Shopify, WooCommerce, any site) brings the title, description and price; pictures (up to 8) and a video come too only when the creator ticks a second box saying they may use them (`wordsAndPrice(p, withMedia)`). Variants, SKUs and stock are left behind. Videos are copied only as a plain MP4/WebM file under 10 MB (schema.org VideoObject, og:video, Shopify's `/products/handle.js`); Amazon's videos are streams (.m3u8) and can't be, which the preview says. Pictures and videos are copied into the store's media library by `/api/import/media`, which checks the file's real bytes. Everything arrives as a draft. AI (Gemini, structured JSON) checks each fill: real product name without shop/SEO filler, description cleaned of shop text (shipping, returns, offers), the price buyers pay now and any crossed-out price, currency, physical or digital, and up to 3 notes for the creator (`lib/server/import/link.ts`, `applyCheck`). Pages with no product data are read from their own layout (Amazon: productTitle, price to pay, M.R.P., feature bullets, description; else meta tags: `fromPageMarkup`), then from their words by the AI. Fancy Unicode letters are turned back into plain text. Without the AI the fill still works, with a warning. Instead of a site check, the creator ticks "I own these products or have the seller's permission to sell them"; that and the link are recorded (`store_imports.proof` = `rights_confirmed`, `products.source_url`). Sites that refuse server requests or show a robot check (Flipkart does) get a plain "copy it in by hand" message: we don't work around them. Shopify feeds can answer in the visitor's local currency, so each variant's `price_currency` wins, then the shop's `/meta.json`.
- **Tables** (Oct 2026): every list uses `components/pp/data-table.tsx`, which adds summary numbers for the matching rows, a period filter, CSV export (of the matching or ticked rows), row ticks with bulk actions, a Columns menu (choices remembered per table on the device), page size and page numbers. Products: type, stock (low/sold out, per variant), compare-at price, added/updated; bulk make live, move to drafts, duplicate, delete. Orders: items and units, payment (UPI/card/COD) and coupon, optional country, discount, shipping, fees and "you keep"; sales, net, average order, refunds. Customers: repeat or one order, average order, customer since; repeat rate; email the ticked ones. Collections became a table (order kept with the arrows): live/draft counts, units sold, revenue, and how many products aren't in any collection. Leads moved onto the same table with bulk delete and upcoming bookings.
- **Store pages are updated, never inserted from the browser** (Oct 2026): every store gets its five `store_pages` rows from `seed_store_pages` when it's created, and creators may only update them. `savePage` used an upsert, which needs INSERT permission even when the row exists, so saving About/FAQ/policies (and going live with a changed About) failed with "permission denied for table store_pages". It's an update now; no new grant.
- **Checks before publishing** (Oct 2026, `lib/pages/launch-check.ts`, `components/page-builder/launch-check-dialog.tsx`): Publish runs them first. "Fix" = buyers would hit something broken: links to drafts, unpublished pages, missing collections or sections; product cards and buy buttons for drafts or deleted products; empty product grids or collection lists; an ended countdown; and before going live, nothing live to buy, downloads without a file, shipped products with no shipping set. "Worth checking" = unfinished: empty pictures/video/gallery, starter or placeholder text, buttons with no link, empty sections, images without a description, reviews block with no reviews, placeholder FAQ/About, and before going live no logo, no support email, no payout method, policies that are stubs or still the default; unreadable colour schemes when going live or the theme changed. Blocks hidden on every device are skipped. Nothing found on an ordinary publish: it publishes straight away; going live always shows the result. Every item has a fix button (selects the block, opens the panel, or opens the page in a new tab). "Go live anyway" stays available: the check informs, it doesn't lock anyone out, and if it can't run, publishing goes ahead.

## Invoice name, teams and custom domains (Oct 2026, migration 038)

### The name on receipts and invoices

- **Selling needs no GST.** Settings › Company and invoices asks for one thing: the **name on receipts and invoices** (`stores.invoice_name`). GSTIN, PAN, legal name and address are optional; once a GSTIN is typed, the legal name and full address become required, because a tax invoice must carry them.
- **Buyers see it while buying:** the checkout says "Sold by <name>. Your receipt and invoice will be emailed to <their email>" (order confirmation for cash on delivery). The receipt email has a "Sold by" line, and the invoice prints it under "Sold by" (with the legal name under it when registered and different).
- Older stores without one fall back to the legal name, then the store's name, everywhere. Buyers may read the column (it's public at checkout); GSTIN and PAN stay private.
- The getting-started step is now "Set your invoice name" and counts as done once it's saved.

### Store teams

- **Invite by email** from Settings › Team. The invite is a link valid for 7 days; only someone signed in with that exact email can accept it (`team_accept` checks the account's email). New people sign up from the link and come straight back to it. If email isn't connected (no `RESEND_API_KEY`/`MAIL_FROM`), the screen gives the link to copy instead of claiming it was sent. "Send a new invite link" replaces the old link.
- **Roles:** Owner (one, the store's creator); **Admin** (every area, can invite and manage Limited people; only the owner makes or changes admins); **Limited** (only the areas ticked). Areas (`lib/team.ts`): Products (catalog, media, SKUs, tax codes), Orders and customers (orders, shipping, refunds, customers, leads, reviews and questions), Store design (editor, pages, policies, SEO, analytics tags, domain), Offers (coupons, bundles, deal paths, marketplace deals), Analytics (dashboard figures), Business details (store settings, company, invoice name, tax).
- **Always the owner's:** payouts and payout accounts, billing and the plan, deleting the store, making admins. Plan features (Pro, custom domain, AI page allowance) follow the **owner's** plan, whoever on the team uses them.
- **Seats:** `plan_limits.team_seats`, Free 2, Pro 10 (invited and joined count; the owner doesn't). Easy to change in the table.
- **The database enforces it.** `store_can(store, area)` replaced the owner check in every store policy (products, collections, media files, orders and their views, leads, reviews, questions, pages, drafts, offers, domains, analytics, storage). `is_product_owner` now means "can work on the catalog". Team members can update the `stores` row only in their areas' columns (`guard_store_member_update`: design = name, tagline, logo, theme, status; business = support email, refund days, invoice and company details, shipping); owner, slug, country and currency never. `team_list`, `team_invite`, `team_invite_info` (no secrets, works signed out), `team_accept`, `team_update`, `team_remove`, `my_stores`. `store_members` is read-only to clients. Tested with a throwaway user in a rolled-back transaction.
- **In the app:** the store switcher lists joined stores with the role; the menu, settings tabs and phone tabs hide what the person can't open; opening one anyway shows "This part of the store isn't in your access" (`components/team/access-guard.tsx`). A member without Analytics gets a start page listing their areas instead of the dashboard. Members don't see the owner's setup checklist. Anyone can leave a store from Settings › Team. Someone who only belongs to other people's stores is never sent to onboarding.
- Found on the way: `/api/import/*` accepted any published store id (published stores are readable by everyone) and copied media into it with the server key. It now checks `store_can(store, 'catalog')`.

### Custom domains, finished

- Pro (the owner's plan). Settings › Domain: type a domain, add the records shown, and it goes live by itself. The page checks every 30 seconds while open; **a scheduled job (the Worker's cron, every 10 minutes, calling `/api/cron/domains`) checks the rest**, so nobody has to keep the page open. Live domains are re-checked every 6 hours: a problem is shown on the page but the store stays up (a DNS hiccup shouldn't take it offline). A domain whose records never appear in a week is marked failed; Verify now tries again.
- **A bare domain gets www too** (its own custom hostname; the proxy sends www visitors to the bare domain with a permanent redirect; the page shows the extra CNAME). A subdomain like shop.yourname.in doesn't.
- **Clean addresses:** on the store's domain, links written as `/s/<store>/…` redirect to `/…`. Order, invoice, lookup and checkout pages work on the domain, and buyer emails (receipt, shipped, refund, payment failed) link to the domain once it's live.
- **"Send visitors of your free address here"** (on by default, `domains.is_primary`): on PowerProof's production address, `/s/<store>/…` sends visitors on to the domain (a temporary redirect, so switching it off takes effect straight away). Not on localhost or `*.workers.dev` previews.
- The old-address redirects in `next.config.ts` (`/products` → `/catalog/products` and so on) now apply only on PowerProof's own hosts; before, `/products` on a custom domain would have been sent into the creator app.
- Team members with Store design can manage the domain.
- **Needs:** the Cloudflare setup in the README ("Custom domains on Cloudflare"): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CNAME_TARGET`, `NEXT_PUBLIC_SITE_URL`, and `CRON_SECRET` for the scheduled check.

### Questions for the founder

1. **Team seats:** Free 2 and Pro 10 are placeholders. Right numbers? Should teams be Pro-only?
2. **Order emails to the team:** new-order emails still go to the owner only. Should people with Orders access get them too?

## Hosting on Cloudflare Workers (Oct 2026)

- **The founder chose Cloudflare Workers** over Vercel. The app is built with `@opennextjs/cloudflare` 1.20.10 (`npm run deploy`); `worker.ts` wraps the generated Worker and adds the cron trigger. Settings and secrets: README › "Deploying to Cloudflare Workers". `vercel.json` was removed.
- **`proxy.ts` stays** (Next 16's name for middleware, Node runtime). OpenNext supports it since late 2026 but calls Node middleware "experimental" and not officially maintained. It was checked on a local `wrangler dev` run of the real build: sign-in redirects, the old-address redirects, a store page, invite links, the cron route and the scheduled trigger all worked. If it ever misbehaves, the fallback is renaming it to `middleware.ts` on the Edge runtime (nothing in it needs Node).
- **Custom domains are Cloudflare for SaaS custom hostnames** (`lib/server/cloudflare.ts`) on PowerProof's zone, with the Worker as the fallback origin (a `*/*` route). Certificates are checked over HTTP, so a CNAME is all a creator adds; Cloudflare's optional TXT ownership record is shown too while pending. The page explains problems from Cloudflare's answer plus a public DNS lookup (DNS over HTTPS): no record, pointing elsewhere, a clashing record, a CAA record blocking the certificate, or nearly there. A certificate check that timed out is restarted on the next check.
- **Bare domains** need a CNAME at the root: fine on Cloudflare DNS (flattening) and hosts with ALIAS/ANAME; elsewhere the page says to use a subdomain. With apex proxying on the zone (a Cloudflare plan feature), `CLOUDFLARE_APEX_IPS` switches bare domains to A records.
- No incremental cache (R2) is set up: pages read live data. Add one in `open-next.config.ts` if ISR or the fetch cache is used later.

### Question for the founder

1. **Apex proxying:** does the Cloudflare plan include it? Without it, creators whose DNS host can't put a CNAME on the bare domain must use a subdomain (shop.yourname.in).

