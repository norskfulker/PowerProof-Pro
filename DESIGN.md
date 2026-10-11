# PowerProof — Design

Instant stores for creators selling digital products: add a product, share a link, get paid.

Source of truth for how the app is built. `README.md` is how to run it. `DECISIONS.md` is why small calls were made.

## 1. Product shape

Three surfaces, one codebase:

| Surface | Routes | User |
|---|---|---|
| Marketing | `app/(marketing)/`: `/`, `/pricing`, `/how-it-works` | Visitor |
| Creator app | `app/(app)/`: `dashboard`, `getting-started`, `catalog/`, `store/[id]/`, `sales/`, `tools/`, `settings/` + `app/onboarding/` (5-step) | Signed-in creator |
| Buyer storefront | `app/(buyer)/`: `/s/[store]` (home, products, `c/[collection]`, `[product]`, about, faq, contact, `policies/*`, `p/[slug]`); `/checkout`, `/success`, `/order`, `/invoice`, `/lookup` | Anonymous buyer |
| Editor | `app/(editor)/` full-screen visual page editor | Creator |
| Founder console | `app/admin/`: overview, creators, stores, orders, payouts, disputes, moderation, audit, search | `app_metadata.role = "admin"` |
| Auth | `app/(auth)/`: `/login`, `/signup`, `/forgot-password`, `/verify-email` | Visitor |

Core rules:

- Supabase only. No demo mode, no mock data, no sample content. Empty lists show an empty state with one next step.
- Features needing an unconnected server (payments, emails, DNS, image service) say **Coming soon**, never faked.
- Browser stores only: session cache, cross-tab change signal, display prefs (theme, collapsed menus, recent searches). Business state is never in the browser (enforced by test).
- No buyer accounts. Receipt email / success page / `/lookup` → fresh link to `/order/[token]` (30 days, hashed in `download_tokens`).
- Digital = Buy now straight to checkout, no cart. `components/pp/cart.tsx` exists for physical only.

## 2. Stack

- Next.js 16.3 App Router, React 19, TypeScript. `proxy.ts` is the route guard (Next 16 name for middleware).
- Tailwind CSS v4, tokens as CSS vars in `app/globals.css` mapped through `@theme`.
- shadcn/ui new-york + Radix in `components/ui`, restyled in place.
- TanStack Table v8, zod 3 + react-hook-form, Recharts 3 (colors from `var(--chart-*)`), zustand (page-builder draft store), React Email in `emails/`.
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`). Storage bucket `store-media/<store-id>/…`.
- Deploy: Cloudflare Workers via `@opennextjs/cloudflare`. See `wrangler.jsonc`, `worker.ts`, `open-next.config.ts`, `public/_headers`.
- Server secrets only in routes: Razorpay checkout/verify/webhook, private downloads, refunds, receipt email, domain attach, GST proxy (`app/api/gst/route.ts`), AI page (`app/api/ai/page`).
- AI page builder: Gemini `gemini-3.8-flash` via `@google/genai` (`GEMINI_API_KEY`, override `GEMINI_MODEL`). AI images: Coming soon, credits in `lib/plans.ts`.
- Tests: Vitest unit tests next to code (`*.test.ts`). Playwright/e2e removed Oct 2026. `npm run test:all` = typecheck + lint + unit + build.

## 3. Architecture

```
pages → hooks/useApi → lib/api (only door) → lib/api/live/* (Supabase queries + row↔app mapping)
                                    ↓
                         lib/types/ (one file per area)
```

- Pages import only `@/lib/api` (`lib/api/index.ts`). `lib/api/live/` holds queries. ESLint blocks `server-only` service-role client in client code.
- Clients: `lib/supabase/browser.ts` (anon + cookie), `server.ts` (server), `admin.ts` (service role).
- Fetching: `hooks/useApi` (loading skeleton + error + retry). Cross-tab refresh via `storage` event.
- Forms: `hooks/useDirtyForm` (autosave 1.2s, "Saving… / All changes saved", flush on leave) + `useFormSaveBar` for react-hook-form. Save bar: top-right on desktop, above tab bar on mobile. In-app leave asks, refresh/close uses browser warning. New-item sheets keep Add/Create button; edits use save bar.
- Nav: one config `lib/nav/config.ts` drives sidebar, phone drawer/tabs, breadcrumbs, palette, empty-state links. Counts/locks in `lib/nav/model.ts` via `getNavCounts()`. Routes follow tree: `/store/[id]/…`, `/store/current/…` redirect, old addresses redirect in `next.config.ts`. Sidebar is ARIA tree with roving tabindex.
- Env: `.env.local` committed encrypted with dotenvx. `scripts/env.mjs check` gates `dev/build/start`. `npm run env:set -- NAME "value"`. `.env.keys` never committed. Build machine needs `DOTENV_PRIVATE_KEY_LOCAL`. `NEXT_PUBLIC_*` baked at build time.

## 4. Data model (Supabase)

Migrations in `supabase/migrations/` are the record. Key tables:

- `stores`: theme, brand_color, logo_url, country, currency (locked once products exist), slug (locked, `015`), company_address (6 lines), PAN/business type, theme_mode mirror.
- `products`: digital/physical, status `live`=published, SKU (case-insensitive unique per store), HSN/SAC + gst_rate, currency forced to store's, file required for digital, collection required for physical. Variants (≤3 options, ≤100 combos, own price/SKU/stock), stock counting in `034–035`.
- `collections`, `coupons` (basis points, whole-store or one product, one per order), `deal_rules` (bundle-discount + free gift live, rest coming soon), deal paths evaluated by pure `lib/pricing/deals.ts` → `evaluateDeals`.
- `orders`, `order lines`, `ledger` (3h hold → `available_at`), `payout methods` (≤5 bank + ≤5 UPI + ≤5 crypto, bank name rule), `payouts`, `disputes` (Razorpay `payment.dispute.*` → `record_dispute`), `download_tokens` (hashed, RLS none, server-only).
- `store_pages` (about/faq `{items, contactNote}`, policies `{text}`), `custom_pages` (public `layout`: template + published + SEO) + `custom_page_drafts` (owner-only draft/versions/unpublished home theme, `031`), home = slug `home` template `home`, excluded from page limit.
- `reviews` (+`pinned` ≤3, creator replies once, hide by staff only), `questions` (1-level answers), `reports` (`report_content`, deduped/capped) → Admin Moderation.
- `leads/bookings` (`submit_lead`, `booked_slots`), `store_events` (`track_event`, cookieless, DNT respected), `fx_rates` (per USD, public read, staff write; empty = no currency picker, display-only conversion), `tax_codes` (owner-only), `domains` + `resolve_domain()`, `plan_limits`, `profiles.onboarding` (getting-started flags), `activity_days` / `profiles.last_seen_at` (`touch_activity`), `audit_log` (last 500).
- Buyer/visitor RPCs (`025–027`): `create_order`, `validate_coupon`, `get_order`, `lookup_order`, `submit_review`, `ask_question`, `submit_lead`, `track_event`. Admin RPCs (`028–030`): `admin_*` + `admin_reveal_buyer_phone` (reason → audit). Checkout priced server-side (`lib/server/checkout.ts` + `create_order`), paid only via signed proof (`/api/checkout/verify`) or webhook (`/api/webhooks/razorpay` via `webhook_events` dedup → `apply_payment`, idempotent). Free orders skip gateway.
- Field mapping quirks: `published`→`live`, "Notion kit"→`template`, generated covers as `cover:<json>` in `product_media.url`, invoice numbers `PREFIX-0001` per store.

## 5. Design system

Reference: `/design` page renders every token/component/state.

Tokens (`app/globals.css`): porcelain `#F5F6F4`, ink `#0C1F1B`, emerald `#0F3D33` (actions), brass `#C9A24F`/`#A9823A` (emphasis) + status colors, chart 1–5, radii, type scale. Components use tokens only. Exceptions: cover/tile palettes (`lib/palettes.ts`), store brand color, `emails/theme.ts` (literal copy, email clients ignore vars), sandboxed HTML buy button, root `themeColor`.

- Type: Bricolage Grotesque 800 headings, Hanken Grotesk body, IBM Plex Mono labels/amounts. All via `next/font/google` (self-hosted). Scale 12–64, fluid `clamp()` for 28+, all `rem`. Noto Sans Devanagari/Tamil/Telugu/Kannada load only when script present.
- Radii: control 10, media 12, card 16, dialog 20; only pills are `rounded-full`.
- Light + dark: `:root`/`[data-theme=light]` and `[data-theme=dark]` (`#0A1412` bg, `#101D1A` surface, primary `#3AA584`). `dark:` variant wired to attribute. No-flash inline script reads `pp:theme`. Shadows become borders in dark; photos dim to 88% via `.dim-media` (covers don't). Print + email/invoice force light. Every pair AA-tested in `lib/theme.test.ts`.
- Contrast fixes: small brass `--accent-ink #7A5C20`, warning `--warning-ink #8A5A12`, input border `--input #8F9B95` (light).
- Store themes (`lib/store-themes.ts`, `StoreThemeScope`): 6 palettes × light/dark, optional brand accent (`color-mix` soft/strong/ink), 3 font pairs (Modern/Editorial/Clean), custom uploaded font (`theme.customFont`), corners sharp/soft/round. Color schemes (`StoreTheme.schemes`, Shopify-style, 5 defaults): `[data-store-mode]` tokens via `schemeCss`; sections pick scheme by id or own background. Contrast warnings at <4.5:1 or photo/video without 35%+ overlay.
- Money: `{amount: minor units, currency}` only. `MoneyText`/`formatMoney` only. INR Indian grouping.
- Motion: `--dur-fast 150ms`, `--dur-base 200ms`, `--ease-out`. Marquee pauses on hover/focus, static under `prefers-reduced-motion`.
- Accessibility: 44px targets on `pointer:coarse`, `overflow-wrap:anywhere` zero-specificity rule, scroll regions focusable only when overflowing, filter-tabs as `aria-pressed` buttons, paged long lists (reviews 10, inbox 20), per-platform visual baselines 0.1%.
- Dialogs only for destructive + withdraw; everything else (template preview, bank form, SKU/tax edit, image maker, payment handoff) is a sheet. Toasts top on mobile (never cover save bar).

## 6. Key flows

- Onboarding → first product (3-step wizard, same `ProductForm`): basics → images/files → price/publish. Going live needs file (digital) or collection (physical); `publishProduct` + `components/products/readiness.ts` explain gaps. Drafts always labeled "Draft: not visible to buyers".
- Bulk: `/catalog/products/import` CSV (`title,description,type,kind,price,original_price,sku,hsn_sac,gst_rate,collection`, ≤500 rows, store currency, drafts + per-row checklist).
- Media: one uploader (`components/media/media-uploader.tsx`): JPG/PNG/WebP ≤5MB, GIF ≤5MB, MP4/WebM ≤10MB. Library = Storage listing, usage map across stores, delete-used confirms. Products ≤8 images +1 video, button reorder. Review photos validated but excluded from library.
- Store editor (`components/page-builder`): left tree (Header/sections/Footer, drag grip, show/hide, + to add, inline section rename via options) with Sections/AI-chat tabs on top + Theme tab; center iframe portal (real header/footer, click-select, inline text, Add-section lines); right inspector. Both sidebars pin with their own scroll and collapse from the top bar (page switcher, centred device previews, history, icon-only Versions, View live, Build with AI next to Publish). Store content (About, Reviews, Questions) lives under the Policies tab and opens as editor panels; FAQ stays under Design. Draft autosave, undo 100 snapshots, Publish copies draft→live + version (20 kept), Discard restores. Draft autosave, undo 100 snapshots, Publish copies draft→live + version (20 kept), Discard restores. Home publish on hidden store makes it live. Header/footer links don't navigate (offer target editor). Icons: ~150 Phosphor (`components/pp/icon-library.tsx`). AI Build (`/api/ai/page`, `start_ai_page`/`finish_ai_page`, Free 100 messages lifetime then Pro 10/day IST; each chat message is one run): strict one-section tool calls, real products/images/links/reviews only, one undo step + "AI draft" version. Adding a section is presets, or the AI chat tab beside Sections in the left sidebar (`AiChat`: one focused section per typed message, spliced after the selected section or at the end); full-page briefs stay in the Build dialog. One shared run store (`ai-build-store.ts`) drives both, with one keep/discard review bar.
- Checkout: guest name+email+phone (country picker + length rules), coupon-only at checkout, Pay button shows exact total and never moves (side panel desktop, fixed bar mobile). Deal panel suggests only (never preselected), sorted by saving, 3 + See more, Skip+undo. Order: item discounts → count tiers → spend threshold (pre-discount) → cheapest-free → gifts (once, line-becomes-free if already in cart) → order bump (fixed, never discounted, bundles skip deal paths) → coupon. Floors block % discounts (free mechanics ignore). COD: India, physical-only, optional fee/cap, stock on place, creator marks cash, fee via `adjustment`. Shipping: flat by zone, free-over, GST at main-item rate, own invoice line. Refunds: full only, original method, ledger reversed (platform returns fee), downloads stopped.
- Tax/invoice (`lib/invoice.ts`, `lib/invoice-view.ts`): prices include GST by default (Settings›Tax switchable). No GSTIN → no tax. India → IGST (CGST+SGST if delivery state = seller state; buyer state not collected → IGST default). Abroad → export nil/LUT. Default SAC 9984xx 18%. GSTIN field live-checks format + fills state/PAN; name/address needs `GST_LOOKUP_URL/{gstin}` + key (server route only).
- Payouts: ₹100 min, no fee, 3h hold. Bank/UPI = INR rail (dollar balance converted at stored `fx_rates` via `lib/payout-plan.ts`); non-IN/crypto = manual queue. Bank added → registered with Razorpay (`/api/payouts/methods`, full number never stored). Staff Send (`/api/payouts/[id]/send`, payout id = idempotency, IMPS/UPI ≤₹5L else NEFT) → `payout.*` webhooks → `settle_payout_by_gateway`. Manual: staff marks paid + ref or failed (returns via `settle_payout`).
- Domains: Cloudflare for SaaS. Server adds custom hostname, shows DNS, re-checks 30s + 10-min cron (`worker.ts`, `CRON_SECRET`). Proxy serves active domain from `/s/<store>`. Apex needs `CLOUDFLARE_APEX_IPS` or CNAME-at-root host.
- Search (`lib/api/search.ts`): `#1042`/`PP-1042`/3–6 digits = order, `@` = email, 7+ digits = phone, `@slug` = store scope, `INV-` = invoice. Admin masked (`pr••••@gmail.com`), Reveal + quick actions (open/copy/refund/hide/suspend) confirm + audit. Arrows/Enter/Tab/Ctrl+Enter/Esc, actions bar under list.
- Admin: `is_admin()` rechecked in every RPC. Money per-currency, never summed. Suspend→prior status on lift (trigger blocks seller self-lift). Overview 3/7/30d + prior-period compare, active = `touch_activity`, visitors = `store_events` sessions, online-now 5min/15s poll.

## 7. Plans

Single place: `lib/plans.ts` + `plan_limits` table. Free: 1 store, 10 products, 3 pages, 10 AI credits/mo, 1 AI page/day. Pro: unlimited stores/products/pages, 200 credits, 10 AI pages/day, $20/mo first month free. Both 3% + ~2% gateway. Limits enforced in DB (`LimitError` code `limit`) → Upgrade dialog via `GuardedLink`/`plan.guard`. Downgrade: keep selling, block new creates. `STORAGE_QUOTA_BYTES` 2GB.

## 8. Conventions

- Look before you create: reuse `components/`, `lib/api/`, `lib/nav/config.ts`, one shared component per idea; extend tables/constraints before new ones. DB change = numbered file in `supabase/migrations/` + run advisors (expected: RLS-none `download_tokens`/`webhook_events`, open `store_is_public`/`product_is_public`/`validate_coupon`/`resolve_domain`, owner/admin-checked DEFINER fns).
- Never add fixtures to app code (ESLint). No `cn` package (`@/lib/utils`).
- File map: `components/ui|pp|<area>/`, `hooks/useApi|useDirtyForm|useMediaUrl|useNow|useScrollFocus`, `lib/api|api/live|defaults|nav|pages|pricing|server|types`, `emails/`, `supabase/migrations/`.
- Scripts: `dev/build/start/lint/typecheck/test/test:all/preview/deploy`. `NEXT_PUBLIC_SITE_URL` must be real (receipts + domain routing).
