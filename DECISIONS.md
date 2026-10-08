# Decisions and open questions

Small calls made while building the frontend, so the founder can check them in one place. Everything here is easy to change.

## How we work on this codebase

- **Look before you create.** Before adding a file, component, table or column, find the folder, component or table that already does the job and change that. Create something new only when nothing existing fits, and say why. This applies to code (`components/`, `lib/api/`, `lib/nav/config.ts`, one shared component per idea such as `ColorModeToggle`, `StatusTabs`, `BrandColorPicker`) and to the database (check `supabase/migrations/` and the live schema first; extend an existing table or constraint before adding a new one).
- **Database changes go in a numbered file in `supabase/migrations/`** and are applied to the project; the file is the record.

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

## Data layer

- **Pages only import `@/lib/api`.** Every function there reads and writes Supabase (`lib/api/live/*` holds the queries and the row to app-type mapping). There is no other backend, no mock and no switch to turn one on: if the Supabase variables are missing the app says so.
- **Types live in `lib/types/`** (one file per area, re-exported from `index.ts`).
- **Pages fetch through the `useApi` hook**, so loading skeletons and error states with retry are real. A change in one tab tells other tabs to re-read through a `storage` event.
- **Sign up creates a new, empty store.** Nothing is pre-filled.
- **Nothing is made up.** A list with nothing in it shows an empty state with one next step; a figure with no source (visitors, conversion, sources, funnels, deal usage) shows "No data yet"; a feature that needs a server we don't have shows "Coming soon".
- **Test data lives in `tests/fixtures` and in the rows the end-to-end tests create and delete.** App code can't import fixtures (ESLint rule, plus `tests/unit/security/no-demo-data.test.ts`).
- **Admin console** isn't connected yet: every admin screen says so.

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
- **The marketplace** (`/marketplace`) lives inside the creator app and needs sign-in (the page, and the database function too: anonymous callers can't run it). It lists **deals** that creators list from their own live products (Catalog › Marketplace deals): one-time or subscription, original price and deal price, one deal per product. Saving a deal sets the product to those prices so checkout charges what the card shows. Buyers read through one function, `marketplace_deals`, with filters (digital/physical, payment, category, price, badge) and sorts. **Verified** is set by PowerProof staff (`verified_at`, which creators can't write). **Trusted seller** is worked out from orders: at least 5 paid, refunds at most 5%, reviews at least 4 stars. Each deal carries its seller's country (flag, and a country filter), and prices can be viewed in the viewer's own currency when `fx_rates` has rows (display only). Revenue (total and 30 days) comes from paid orders and is shown only when the creator leaves "Show what this product earns" on. Units sold, and revenue when shared, are visible to signed-in creators only. There is no admin screen yet: staff verify with `update marketplace_deals set verified_at = now() where id = …`.
- **Making a product live is an explicit button** in four places: "Make it live" in the draft notice on the product form, "Create and make it live" (or "Save as draft") at the end of the first-product steps, "Make it live" / "Move to drafts" in the products list menu, and per product (and "Make every ready product live") in the checklist after an import. Going live needs a file (digital) or a collection (physical); `publishProduct` says which is missing. Pictures and a type are advice only.
- **Drafts always say so in words** ("Draft: not visible to buyers", with what's still needed: `components/products/readiness.ts`) in the product list, the product form and after an import. Save and Discard sit at the top of the product form.
- **A creator's first product is three steps** (the basics, images and files, price and publish), shown by the same `ProductForm` with `wizard`; after that it is the full form. Onboarding is a name and a country, then straight to that first product.
- **Sidebar groups only open and close.** They have no page of their own; items nested under them are drawn as a tree.
- **Live orders sit inside Analytics** on the dashboard and appear once a product is live. Charts with no data stay as empty charts.
- **One way to add a digital product for now:** upload a file (`/products/new/upload?type=digital`). Importing from a link and the old product sales pages were mock-only, so they were removed; the visual page editor (Store › Design › Pages) replaces sales pages.
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

The gateway integration and webhooks, real email sending, `embed.js`, custom domains, team seats, the AI image maker, the founder admin console, analytics ingestion (visitor, conversion and source figures show "No data yet"), GA/Clarity script injection on buyer pages.

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
- Creators can **reply once** (labelled Creator) and **pin up to 3** (`reviews.pinned`). Only PowerProof can hide a review. They cannot edit stars or text. Helpful votes and imported testimonials were removed: nothing stored them.
- **Reports** from reviews and questions show up in the founder admin's Flagged content. Removing a flag hides the item; dismissing clears the report.
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

- **Coming soon.** Connecting a domain needs DNS and certificate checks on the server. The screen says so; `lib/api/domains.ts` keeps only the provider guides, DNS targets, problem explanations and hostname checks for when it is built.

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

- **`/lib/api` is the only door, and it only talks to Supabase** (`lib/api/live/*`). There is no mock backend and no `NEXT_PUBLIC_BACKEND` switch. Unit tests use fixtures in `tests/fixtures`; the end-to-end and integration tests use the two test creators and create and delete their own data.
- **Clients:** `lib/supabase/browser.ts` (anon key + session cookie), `server.ts` (same, for server code), `admin.ts` (service role). The service-role client imports `server-only`, ESLint blocks it in client code, and `tests/unit/security/service-role.test.ts` fails if the key is read anywhere else, imported by a client file, or found in the browser bundle.
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

- Coming soon on the live backend: team seats, analytics integrations, limited-time store-wide sales, imported testimonials, renaming library files.
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
- **Custom domains** use the existing `domains` table and `resolve_domain()`; the server attaches the domain through Vercel's API, shows the DNS records, re-checks every 30 seconds, and the proxy serves an active domain's store from `/s/<store>`.
- **Analytics:** the storefront counts visits itself (`track_event`, cookieless, Do Not Track respected) for the dashboard; Google Analytics and Clarity load only after the visitor agrees.
