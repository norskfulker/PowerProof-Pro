# PowerProof frontend

Instant stores for creators selling digital products: add a product, share a link, get paid. This repo is the complete frontend. **There is no backend yet.** Every screen runs on a typed mock data layer that lives in the browser.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (also typechecks) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:ui` | Component tests only |
| `npm run test:e2e` | Playwright: layout on every screen size and engine, flows, stress data |
| `npm run test:a11y` | axe on every route (zero serious or critical issues) |
| `npm run test:visual` | Screenshot comparisons at phone, tablet and desktop |
| `npm run test:all` | Everything above, plus a production build |

Playwright runs against a production build on port 3100, so run `npm run build` first (test:all does). First time only: `npx playwright install`. See `QA_REPORT.md` for the screen matrix and results.

Deploy: push to Vercel. No environment variables are needed.

## Walk the main flow

1. **Sign up** at `/signup` (any name and email, 8+ character password). The code on `/verify-email` is any 6 digits.
2. **Onboarding** (`/onboarding`): name your store, skip or fill business details, add a bank account (`HDFC0000123` works as an IFSC), add your first product, publish.
3. **Buyer:** open your store at `/s/<your-slug>` in another tab. Buy, fill name, email and phone, accept the terms, tap **Approve payment** in the test-mode sheet.
4. **Buyer downloads** from the success page.
5. **Creator sees the sale** appear in *Live orders* on `/dashboard`, without reloading.
6. **Creator opens payouts** at `/payouts`. New sales are pending for two days; the sample store has money available to withdraw.

Want a full store instead? Log in at `/login` with any email and an 8+ character password, or use **Avatar menu › Demo data › Load sample data**. The same menu can empty the store or make every request fail, to review error states.

## Walk the store

1. Open a store: `/s/ananya`, `/s/inkwell` or `/s/gridgrain` (each has its own theme).
2. Browse `/s/ananya/products`, search, filter by collection, open a product and read the reviews.
3. **Buy now** → fill name, email and phone → apply `FESTIVE20` → accept the terms → **Approve payment**.
4. On the success page, open your files or **Write a review** (both go to your private `/order/[token]` page).
5. As the creator: `/store/design` (toggle sections, change theme, publish), `/store/offers` (add a coupon), `/store/reviews` (reply).

## Walk the new pieces

- **Global search.** In the founder admin (`/admin`) press **Ctrl K** (or use the search box). Try `#1042`, an email, `+91 98`, or `@inkwell`. Buyer emails and phones are masked; highlight a result, press **Ctrl Enter**, choose **Reveal email**, give a reason, and see it logged at `/admin/audit`. `/admin/search?q=...` has every result in tabs. Creators get the same palette inside the app, limited to their own store.
- **Deal paths.** Buy *Second Brain for Founders* on `/s/ananya`. At checkout the **Build your deal** panel offers the Pricing Playbook at 25% off together and a free gift over ₹1,500. Add, remove, pick a gift, or say **No thanks**. Creators manage rules at `/store/offers/deal-paths` (wizard with a live test mode, and stats).
- **Visual page editor.** `/store/pages` lists each store's visual pages (three per store). Open one to edit: add blocks, change backgrounds, switch phone/tablet/desktop, undo with Ctrl Z, then **Publish changes**. Published pages live at `/s/<store>/p/<slug>` and are linked from the store footer. About, FAQ and policies moved to `/store/info`.
- **Stress data.** **Avatar menu › Demo data › Load stress data** fills the store with very long and unbroken text, Hindi, Tamil, Telugu and Kannada titles, 500 products and orders, and 5,000 reviews.

## Where things are

```
app/
  (marketing)/      / , /pricing, /how-it-works, /templates
  (auth)/           /login, /signup, /forgot-password, /verify-email
  onboarding/       5-step setup
  (app)/            creator app: dashboard, products, images, pages, orders,
                    customers, payouts, analytics, integrations, settings/*
  (buyer)/          /s/[store] (home, products, c/[collection], [product], about,
                    faq, contact, policies/*), /checkout, /success, /order/[token],
                    /lookup, /invoice
  (app)/store/      store design, collections, offers (+ deal-paths), reviews, questions,
                    pages (visual pages list, versions), info, SEO, domain
  (editor)/         full-screen visual page editor: /store/pages/[id]/edit
  admin/            founder admin (darker shell), search, audit log
  emails/           React Email previews
  design/           design system reference (kitchen sink)
components/
  ui/               shadcn components, restyled with PowerProof tokens
  pp/               product components (MoneyText, DataTable, StatCard, store and checkout pieces, ...)
  storefront/       the store shell, home sections and product page parts
  search/           global search palette, result rows, audited quick actions
  page-builder/     visual editor (EditorShell, Canvas, panels) and the shared PageRenderer
  <area>/           screen pieces per area (dashboard, products, buyer, ...)
emails/             React Email templates
hooks/              useApi, useBuyerCurrency, useNow, useScrollFocus
tests/
  unit/             component tests (Testing Library); lib tests sit next to their code
  e2e/              Playwright specs: layout, a11y, flows, stress, visual
lib/
  api/              the only data door for pages; swap bodies for fetch()
  mock/             in-browser mock database, seed and stress data
  pages/            page schema (zod), templates, editor store (zustand), media limits
  pricing/          prices, coupons, bundles, and deals.ts (deal paths engine)
  types/            domain types (Money is integer minor units + currency)
  money.ts          formatting, conversion, fee maths
```

## Connecting the backend

Pages call `@/lib/api` only. Each function there (for example `getProducts`, `createProduct`, `payOrder`) currently reads and writes `lib/mock`. Replace the body with a request to the real API and keep the signature. `lib/api/client.ts` is where latency and simulated failures live; drop it when the real client lands.

## Design system

Tokens are CSS variables in `app/globals.css`: porcelain, ink, emerald (actions) and brass (emphasis), plus status colours, radii and type scale. Bricolage Grotesque 800 for headings, Hanken Grotesk for body, IBM Plex Mono for labels and amounts. Browse `/design` for every component and state.

## More

`DECISIONS.md` lists the assumptions behind this build and the questions still open for the founder.
