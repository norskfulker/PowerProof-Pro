# PowerProof

Instant stores for creators selling digital products: add a product, share a link, get paid.

The app talks to **Supabase only**. There is no demo mode, no mock data layer and no sample content. Every screen shows what is in the database, and a screen with nothing to show says so, with one clear next step. Anything that needs a server we don't have yet (payments, emails, DNS checks, an image service) is labelled **Coming soon** instead of being faked.

## Run it

```bash
npm install
npm run dev
```

### Settings and secrets (`.env.local`, encrypted)

`.env.local` is committed, **encrypted** with [dotenvx](https://dotenvx.com): every value in it reads `encrypted:…`, so the file is safe in the (public) repo. `npm run dev`, `build` and `start` decrypt it on the fly. The one key that decrypts it is in **`.env.keys`**, which is never committed.

- **On a new device:** clone, `npm install`, then create `.env.keys` in the project folder with the line `DOTENV_PRIVATE_KEY_LOCAL=…` (copy it from your password manager or the old device). That's all; `npm run dev` works.
- **Change or add a value:** `npm run env:set -- NAME "value"` (it's encrypted as it's written). To see a value: `npx dotenvx get NAME -f .env.local`.
- **Never commit `.env.keys`**, and never edit `.env.local` in plain text. A pre-commit check (`.githooks/check-env.mjs`, switched on by `npm install`) stops a commit that would put a readable secret or the key file in git.
- Building somewhere else (CI, Cloudflare's build): set `DOTENV_PRIVATE_KEY_LOCAL` as a secret environment variable there.

Open http://localhost:3000. If the Supabase variables are missing the app says so and stops; it never falls back to made-up data.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (also typechecks) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest; each sits next to its code as `*.test.ts`) |
| `npm run test:all` | Typecheck, lint, unit tests, then a production build |
| `npm run preview` / `npm run deploy` | Build for Cloudflare Workers, then run locally / deploy (see below) |

The end-to-end, accessibility, visual and integration suites (Playwright, `tests/`) were removed in Oct 2026; only the unit tests next to the code remain.

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
  admin/            founder console (overview, creators, stores, orders, payouts, disputes, moderation, audit, search)
components/         ui/ (shadcn), pp/ (product components), and one folder per area
hooks/              useApi, useDirtyForm, useMediaUrl, useNow, useScrollFocus
lib/
  api/              the only data door for pages; every function reads and writes Supabase
  api/live/         the Supabase queries and the row <-> app type mapping
  defaults/         starter copy for a new store (policies, FAQ, design) with no names, prices or links
  tax-codes.ts      the GST reference list (products save their own code and rate)
  database.types.ts generated from the Supabase schema
```

## What lives where

- **In the database:** stores (including PAN and business type), products (SKU, HSN/SAC code, tax rate), collections, coupons, deal paths and bundles, reviews (including `pinned`), questions, store pages, custom (visual) pages, payout methods, payouts, plan limits, getting-started progress (`profiles.onboarding`).
- **In Supabase Storage:** the media library and product files. The library list is read from the bucket.
- **In the browser:** only who is signed in (a cache of the Supabase session), a change signal between tabs, and display preferences (theme, collapsed menu groups, recent searches). Nothing about the business is kept there; a test checks it.
- **Not tracked yet, so shown as "No data yet":** visitors, conversion, traffic sources, funnels, deal path usage and revenue lift. Buyer currency conversion needs rows in the `fx_rates` table (no rate source is connected, so it starts empty and the picker stays hidden): prices show in the store's currency until then.

## Database changes

SQL for what the app needs lives in `supabase/migrations/`. `014_plan_limits_fulfilment_payout_methods.sql` makes Free 10 products and 3 pages, adds digital/physical to products, crypto wallets to payout methods and the limit of 5 per kind (with the bank account name rule); `015_store_slug_locked.sql` stops a store's link being changed; `017_store_media_fonts.sql` lets stores upload font files; `018_leads_bookings_marketplace.sql` adds leads and bookings; `025_buyer_rpcs.sql` (with fixes in `026` and `027`) lets buyers and visitors act through database functions: opening an order, looking one up, reviewing, asking a question, the contact form; `019_marketplace_deals.sql` adds marketplace deals, their trust badges, revenue and filters, and `020_marketplace_signed_in_only.sql` makes them readable by signed-in users only, `021_marketplace_country.sql` adds the seller's country and a country filter; `016_store_country_currency_fx.sql` adds the store's country, ties every product to its store's currency, locks both once there are products, and adds the `fx_rates` table. `013_sku_hsn_tax_codes.sql` adds format checks on a product's SKU and HSN/SAC code, one SKU per product per store (ignoring case), and the `tax_codes` table for a creator's own codes with their GST rates (only the store's owner can read or change them).

## GST lookup

Settings › Company checks a GSTIN as you type it and fills the state and PAN from the number. To also fetch the registered name and address, connect a GST data provider in `.env.local` (`GST_LOOKUP_URL` with `{gstin}` in it, `GST_LOOKUP_KEY`, optionally `GST_LOOKUP_KEY_HEADER`). The key stays on the server (`app/api/gst/route.ts`); without it the form says live lookup isn't connected.

## Design system

Tokens are CSS variables in `app/globals.css`: porcelain, ink, emerald (actions) and brass (emphasis), plus status colours, radii and type scale. Bricolage Grotesque 800 for headings, Hanken Grotesk for body, IBM Plex Mono for labels and amounts.

## More

`DECISIONS.md` lists the assumptions behind this build and the questions still open for the founder.

## Importing products

`/catalog/products/import` takes a CSV. The page lists the columns and gives a template to download (`title`, `description`, `type`, `kind`, `price`, `original_price`, `sku`, `hsn_sac`, `gst_rate`, `collection`). Prices are in the store's currency; everything arrives as a draft, and the page then lists a checklist per product (images or video, file, type or collection) with the type and collection set right there; physical products need an HSN code, a GST rate and a collection (made if it doesn't exist). Up to 500 rows per file; the plan's product limit still applies.

## Taking it live

Everything below is built; each piece switches on when its keys are set, and says so on screen when they aren't.

| To get | Set | Also do |
| --- | --- | --- |
| Orders, payments, refunds, downloads | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | In Razorpay add the webhook `https://<site>/api/webhooks/razorpay` (events `payment.captured`, `order.paid`, `payment.failed`, and the `payment.dispute.*` events). Test with Razorpay's test keys first. |
| Seller payouts (automatic, rupees to Indian accounts) | `RAZORPAYX_ACCOUNT_NUMBER` (plus the Razorpay keys) | Fund the RazorpayX account; add `payout.processed`, `payout.reversed`, `payout.rejected` to the webhook. Sellers must add their bank account again after this is on, so it is registered with Razorpay. |
| Receipt emails (and resending them) | `RESEND_API_KEY`, `MAIL_FROM` | Verify the sending domain in Resend. |
| Custom domains | `CLOUDFLARE_API_TOKEN` (secret), `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CNAME_TARGET`, `CRON_SECRET` (secret); `CLOUDFLARE_APEX_IPS` only with apex proxying | See "Custom domains on Cloudflare" below. Creators on Pro add their domain on Settings › Domain and set the DNS records shown. |
| Dashboard visits, sources, funnel | nothing | Counted by the storefront itself, cookieless. |
| Google Analytics, Clarity | nothing | Creators paste their IDs on Store › Analytics tags. |
| Live GST lookup | `GST_LOOKUP_URL`, `GST_LOOKUP_KEY` | See above. |

After setting them, open **Admin › Money › Payment gateway**: it shows what's in place, tests the Razorpay keys, and gives the exact webhook address to paste into Razorpay.

`NEXT_PUBLIC_SITE_URL` must be the real site address: receipt links and custom-domain routing use it.

## Deploying to Cloudflare Workers

The app runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`). The files: `wrangler.jsonc` (the Worker, its cron and plain settings), `worker.ts` (OpenNext's handler plus the cron that re-checks custom domains), `open-next.config.ts`, `public/_headers`.

```bash
npm run preview   # build, then run the real Worker locally (wrangler)
npm run deploy    # build and deploy
```

- `NEXT_PUBLIC_*` values are baked in at build time, so build with them in `.env.local` (or the build machine's environment): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Server secrets go to Cloudflare, one at a time: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (and the Razorpay keys, `RESEND_API_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `CLOUDFLARE_API_TOKEN`). Plain settings (`MAIL_FROM`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CNAME_TARGET`) can sit in `vars` in `wrangler.jsonc`.
- For `npm run preview`, local secrets go in `.dev.vars` (git-ignored), with `NEXTJS_ENV=development` on its first line.

### Custom domains on Cloudflare

Creators' domains are Cloudflare for SaaS custom hostnames on PowerProof's own zone. One-time setup, on the zone that holds the site's domain (say `powerproof.store`):

1. **SSL/TLS › Custom Hostnames**: enable Cloudflare for SaaS.
2. Add a proxied DNS record for the fallback origin, `fallback.powerproof.store AAAA 100::` (the Worker answers, so the address is never used), and set it as the **fallback origin**.
3. Add a proxied `customers.powerproof.store CNAME fallback.powerproof.store`. That's what creators point their domains at: set `CLOUDFLARE_CNAME_TARGET=customers.powerproof.store`.
4. Route every hostname on the zone to the Worker: uncomment `routes` in `wrangler.jsonc` (`*/*` on the zone).
5. Make an API token with **SSL and Certificates: Edit** on that zone (`CLOUDFLARE_API_TOKEN`), and set `CLOUDFLARE_ZONE_ID`.
6. Set `CRON_SECRET` so the 10-minute cron can re-check pending domains.

Creators then add a CNAME for their subdomain (or for `@` and `www` on a bare domain, where their DNS host allows a CNAME at the root, as Cloudflare does). Cloudflare checks the domain and issues its certificate; the app marks it live, and sends `www` to the bare domain. If your Cloudflare plan includes apex proxying, set `CLOUDFLARE_APEX_IPS` to its addresses and bare domains get A records instead.
