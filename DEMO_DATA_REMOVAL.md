# Demo data removal: report

The app now talks to Supabase only. There is no mock layer, no backend switch and no sample content. This file lists what was removed, what was kept and why, what was moved into the database, and what is not verified yet.

## Decisions taken

- **Real reads, hide the rest.** Storefront, products, orders, reviews, coupons, deal paths, pages and search read the database. Anything that needs a server that doesn't exist yet (payments, emails, DNS checks, an image service, the founder console) says **Coming soon**. No pretend gateway, no fake persistence.
- **No fallback, anywhere.** If a request fails or returns nothing the screen shows an empty state or an error with retry. If the Supabase variables are missing the app says so (`proxy.ts`, `lib/supabase/env.ts`) instead of running on made-up data.

## Removed

**Mock layer and switches**
- `lib/mock/*` (database, seed, stress data, admin data, other demo stores), `lib/api/scope.ts`, `lib/api/demo.ts`, `lib/api/client.ts`'s simulated latency and failure injection.
- `NEXT_PUBLIC_BACKEND`, `isLive()`, the `build:mock` script, the `cross-env` dependency, the demo-data menu (load sample data, empty store, stress data, simulate errors), `pp:demo` and `pp:seed`.

**Fake records and figures**
- Seeded store "Ananya Makes" and two more demo stores, 12 to 15 products each, 40 orders, 25 customers, 6 payouts, 60 reviews, 20 questions, 4 coupons, 2 bundles, a 48-hour deal, 6 deal paths, 9 visual pages, billing invoices, notifications, a team, integrations, SKUs.
- Fake analytics: synthetic visitor counts, conversion, traffic sources, funnel, and "change vs last period" numbers (`visitorsFor`, the `9.4` and `0.3` deltas).
- Fake order facts the database doesn't hold: `source: "direct"`, `downloads: 0`, `paymentMethod: "upi"` on every live order; the "Receipt and download link emailed" timeline step; "Not downloaded yet".
- Fake deal path stats (views, uses, revenue lift: always 0).
- Fake exchange rates (`INR_PER`, ₹83.40 per dollar) and every converted buyer price, the currency picker, and the "converted at today's rate" note.
- Fake store claims: "N+ sold / buyers in 20+ countries", a "Sold" count on About, helpful votes (`pp:helpful`), made-up offers on a new store's design (`FESTIVE20`, "Festive sale: 20% off everything"), placeholder social links, an empty-store "Welcome! New products are on the way." banner.
- Fake marketing: the hero mock-up ("Ananya Makes", `$17.99`, "New sale ₹1,499.00", `₹1,424.05`), the sample receipt on How it works, the "See a live store" and "Example store" links to `/s/ananya`, the static "On a ₹999 sale" fee table, the templates gallery with sample previews, the pricing calculator's default price and sales count.
- Fake testimonials in a page template (named quotes); now it shows real reviews.
- Mock-only features whose data only ever existed in the browser: link autofill (`autofillFromLink`), legacy product sales pages and the HTML paste editor, the AI image maker and its canvas renderer, the custom domain wizard and its DNS simulator, the mock payment gateway and checkout, order-access tokens and buyer reviews, imported testimonials, the founder admin screens (their mock data), `/design` (the component gallery and its fixtures) and `/emails` (previews built on sample data).
- Hints that pointed at demo behaviour: "Try HDFC0000123 in the demo", "Demo: any 6 digits work", "Demo: any email with an 8+ character password", "Open the demo email", "Mocked in this preview", a toast that said an invoice downloaded.
- Browser-held business data: the IndexedDB file store (`asset:<id>`), `pp:db`, `pp:pins:*`, the local company/invoice/plan/team/integrations/SKU/page stores.

## Moved to the database (item 4)

| Was held in the browser | Now |
| --- | --- |
| Review pins | `reviews.pinned` (max 3 enforced in the app) |
| SKU, tax code | `products.sku`, `products.hsn_sac`, `products.tax_rate_bps` (the GST list in `lib/tax-codes.ts` is reference data; there is no custom code list to keep) |
| PAN, business type | `stores.pan`, `stores.business_type` (app and database values mapped in `lib/api/live/store.ts`) |
| Media library index | Supabase Storage (`store-media/<store id>/…`); the list is read from the bucket |
| Bundles | `deal_rules` (bundle-discount rules) |
| Visual store pages | `custom_pages` (`layout` holds draft, published, versions and SEO) |
| Getting-started progress | `profiles.onboarding` (browser copy is only a cache) |
| Withdrawals | the `request_payout` function |

**Hidden behind "Coming soon":** team seats, integrations, timed store-wide deals, custom domains, the AI image maker, checkout/orders/invoices/lookup for buyers, refunds and receipts from the order screen, product import from a link, imported testimonials, newsletter, contact form, questions from buyers, the founder console, billing cards and invoices, notifications.

**Shown as "No data yet":** visitors, conversion, traffic sources, funnel (dashboard and analytics), deal path usage and revenue lift. "Change vs last period" shows nothing when there's no previous period.

## Kept, and why

- **Starter copy for a new store** (`lib/defaults/store.ts`: FAQ and policy wording, section layout, newsletter heading): it is text the creator edits, marked "Not edited yet". It holds no names, prices, offers or links. Announcement and socials start empty.
- **GST reference codes** (`lib/tax-codes.ts`): regulatory reference data, not store data.
- **Pricing facts** (`$20/month`, 3% platform fee, ~2% gateway, ₹100 minimum withdrawal): real product terms. Plan limits come from `plan_limits`; if they can't be read the pricing page says so and never fills them in.
- **Generated covers**: a product with no image gets generated cover art from its own title; this is a rendering of real data, not a sample.
- **USDT payout option**: shown, labelled "coming soon", cannot be chosen.
- **Browser storage that remains** (a test checks the list): `pp:session` (cache of the signed-in user), `pp:rev` (tab-to-tab change signal), `pp:progress:*` (cache of `profiles.onboarding`), `pp:active-store`, theme, collapsed menu groups, recent searches, per-store theme choice, one-time coach-mark flags.
- **Format hints** in validation messages and placeholders (for example "like 29ABCDE1234F1Z5", `HDFC0001234`, `#1042` in search tips): they show the shape of an input, they are not records.
- **Words in docs and tests**: `README.md`, `DECISIONS.md` and tests mention "mock" or "demo" only to say it is gone, plus `vi.mock` and `mockResolvedValue` (Vitest). The e2e empty-state test greps for these words as its guard.
- **Fixtures** (`tests/fixtures/index.ts`): hand-written made-up records for unit tests. App code can't import them (see below).

## Guards against it coming back

- ESLint `no-restricted-imports`: app code (`app`, `components`, `hooks`, `lib`, `emails`, `proxy.ts`) may not import from `tests/` or any `fixtures` folder. Checked by hand with a temporary file.
- `tests/unit/security/no-demo-data.test.ts`: no import from `tests/` or `fixtures`, no `lib/mock`, no `isLive` or `NEXT_PUBLIC_BACKEND`, no demo controls.
- `tests/e2e/persistence.spec.ts`: after exercising the app, the browser holds only the allowed keys and no IndexedDB store.
- `tests/e2e/empty-states.spec.ts`: every empty screen is free of demo words.

## Tests

- **Unit and component:** 408 tests pass (`npm test`), typecheck and lint are clean, and `next build` succeeds, with and without Supabase variables set.
- **E2E and visual rewritten** to use the two test creators against the real database (`tests/e2e/global-setup.ts`, `support/seed.ts`): creator A gets data (named `e2e …`) and everything is deleted at the end and swept at the next start; creator B is never given data and is used for the empty states, including a layout-shift check. Specs: layout, a11y, empty states, persistence, flows, buyer, stress (long and Indic text on real rows, failed and slow requests through route interception), theme, navigation.
- **Integration:** `tests/integration/empty-account.test.ts` checks that a creator with no data sees empty tables.
- **Not run:** the Playwright suites and the integration tests were not run, because this checkout has no `.env.local` or `.env.test.local` and I can't create accounts on your project. They typecheck and lint, and `playwright test` can't even list them without the setup having run. Run `npm run test:e2e` once the env files exist and fix what it finds.
- **Snapshots:** the old baselines were taken from demo data and pointed at routes that no longer exist, so they were deleted rather than updated. Create new ones with `npx playwright test --grep @visual --update-snapshots`, look at every image, then commit them. I did not update any baseline without seeing it.
- **CI** (`.github/workflows/test.yml`) now needs repository secrets for the Supabase variables and the test creators, and runs the engine jobs one at a time because they share two accounts.

## Things to know

- Generated database types (`lib/database.types.ts`) were stale (no `pinned`, `pan`, `business_type`, `custom_pages`); they are patched to match the live schema. Regenerate them with the Supabase CLI when convenient.
- Published visual pages store the draft and version history in the same `custom_pages.layout` that visitors can read, so unpublished draft text of a published page is readable through the API. Splitting draft from published needs a second column or table.
- Marketing and onboarding copy still describes some things as if they exist (sale alerts on your phone, your logo on receipts, buyers abroad). That is product copy, not data, and I left it; say if you want it trimmed to what's live.
- The e2e specs use selectors written from reading the UI; expect a few to need adjusting on the first real run.
