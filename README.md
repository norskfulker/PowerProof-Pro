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
| `npx tsc --noEmit` | Typecheck only |

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
  (app)/store/      store design, collections, offers, reviews, questions, pages, SEO, domain
  admin/            founder admin (darker shell)
  emails/           React Email previews
  design/           design system reference (kitchen sink)
components/
  ui/               shadcn components, restyled with PowerProof tokens
  pp/               product components (MoneyText, DataTable, StatCard, store and checkout pieces, ...)
  storefront/       the store shell, home sections and product page parts
  <area>/           screen pieces per area (dashboard, products, buyer, ...)
emails/             React Email templates
hooks/              useApi, useBuyerCurrency
lib/
  api/              the only data door for pages; swap bodies for fetch()
  mock/             in-browser mock database and seed data
  types/            domain types (Money is integer minor units + currency)
  money.ts          formatting, conversion, fee maths
```

## Connecting the backend

Pages call `@/lib/api` only. Each function there (for example `getProducts`, `createProduct`, `payOrder`) currently reads and writes `lib/mock`. Replace the body with a request to the real API and keep the signature. `lib/api/client.ts` is where latency and simulated failures live; drop it when the real client lands.

## Design system

Tokens are CSS variables in `app/globals.css`: porcelain, ink, emerald (actions) and brass (emphasis), plus status colours, radii and type scale. Bricolage Grotesque 800 for headings, Hanken Grotesk for body, IBM Plex Mono for labels and amounts. Browse `/design` for every component and state.

## More

`DECISIONS.md` lists the assumptions behind this build and the questions still open for the founder.
