# PowerProof

Instant stores for creators selling digital products: add a product, share a link, get paid.

The app talks to **Supabase only**. There is no demo mode, no mock data layer and no sample content. Every screen shows what is in the database, and a screen with nothing to show says so, with one clear next step. Anything that needs a server we don't have yet (payments, emails, DNS checks, an image service) is labelled **Coming soon** instead of being faked.

## Run it

```bash
cp .env.example .env.local   # then fill in the Supabase URL and anon key
npm install
npm run dev
```

Open http://localhost:3000. If the Supabase variables are missing the app says so and stops; it never falls back to made-up data.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (also typechecks) |
| `npm run lint` | ESLint (also bans importing test fixtures from app code) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit and component tests (Vitest, with test-only fixtures in `tests/fixtures`) |
| `npm run test:integration` | Row level security checks against the real project |
| `npm run test:e2e` | Playwright: layout on every screen size and engine, flows, empty states, persistence |
| `npm run test:a11y` | axe on every route (zero serious or critical issues) |
| `npm run test:visual` | Screenshot comparisons at phone, tablet and desktop |
| `npm run test:all` | Typecheck, lint, unit tests, a production build, then Playwright |

## Tests run against the real database

The end-to-end and integration tests use two throwaway creator accounts on the real project. Put their logins in `.env.test.local` (see `.env.example`):

- **Creator A** gets test data (a product, collection, coupon, page, and with the service-role key also a second product, a deal path, and a paid order with a review). Everything is named `e2e …` and deleted again at the end. A crashed run's leftovers are swept at the next start.
- **Creator B** is never given data. The empty-state tests use it to check what a brand-new account sees.

Playwright's global setup creates the data and signs both creators in through the real login page; the teardown removes it. Playwright runs against a production build on port 3100, so run `npm run build` first. First time only: `npx playwright install`.

Visual baselines are not committed: create them once with `npx playwright test --grep @visual --update-snapshots`, look at every image, then commit them.

## Where things are

```
app/
  (marketing)/      / , /pricing, /how-it-works
  (auth)/           /login, /signup, /forgot-password, /verify-email
  onboarding/       5-step setup
  (app)/            creator app: dashboard, getting-started, catalog/, store/[id]/, sales/, tools/, settings/
  (buyer)/          /s/[store] (home, products, c/[collection], [product], about, faq, contact, policies/*, p/[slug]);
                    /checkout, /success, /order, /invoice, /lookup say "opens soon" until payments are connected
  (editor)/         full-screen visual page editor
  admin/            founder console (not connected yet: every screen says so)
components/         ui/ (shadcn), pp/ (product components), and one folder per area
hooks/              useApi, useDirtyForm, useMediaUrl, useNow, useScrollFocus
lib/
  api/              the only data door for pages; every function reads and writes Supabase
  api/live/         the Supabase queries and the row <-> app type mapping
  defaults/         starter copy for a new store (policies, FAQ, design) with no names, prices or links
  tax-codes.ts      the GST reference list (products save their own code and rate)
  database.types.ts generated from the Supabase schema
tests/
  fixtures/         made-up records for unit tests only (app code can't import them)
  unit/             component tests; lib tests sit next to their code
  integration/      row level security tests against the real project
  e2e/              Playwright specs and the setup that creates and removes their data
```

## What lives where

- **In the database:** stores (including PAN and business type), products (SKU, HSN/SAC code, tax rate), collections, coupons, deal paths and bundles, reviews (including `pinned`), questions, store pages, custom (visual) pages, payout methods, payouts, plan limits, getting-started progress (`profiles.onboarding`).
- **In Supabase Storage:** the media library and product files. The library list is read from the bucket.
- **In the browser:** only who is signed in (a cache of the Supabase session), a change signal between tabs, and display preferences (theme, collapsed menu groups, recent searches). Nothing about the business is kept there; a test checks it.
- **Not tracked yet, so shown as "No data yet":** visitors, conversion, traffic sources, funnels, deal path usage and revenue lift. Buyer currency conversion is off until an exchange-rate source is connected: prices show in the store's currency.

## Design system

Tokens are CSS variables in `app/globals.css`: porcelain, ink, emerald (actions) and brass (emphasis), plus status colours, radii and type scale. Bricolage Grotesque 800 for headings, Hanken Grotesk for body, IBM Plex Mono for labels and amounts.

## More

`DECISIONS.md` lists the assumptions behind this build and the questions still open for the founder.
