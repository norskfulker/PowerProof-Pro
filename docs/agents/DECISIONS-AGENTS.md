# PowerProof Agents: decisions

What was decided while building the agent marketplace and Payment Chaser, and why. `DECISIONS.md` is not edited; this file is the agents' own record.

## Founder's answers (24 Oct 2026)

| Question | Answer | What it means in the code |
| --- | --- | --- |
| Billing | Like Apify: a subscription plus usage credits. A separate Razorpay webhook. **Later.** | Tables `agent_plans`, `agent_subscriptions`, `agent_payment_events` exist. No billing routes yet. Usage & billing shows the plan price with "Coming soon". |
| Trial | 25 credits, no day limit | `manifest.trial = { credits: 25 }`; `days` is optional and unused. |
| Dashboard address | `agents` | Public `/agents`, `/agents/<id>`; signed-in `/agents/my/…`; entry `/agents/start/<id>`. |
| Team access | Owners and admins only, for now | `store_can(store, 'agents')`. Limited members can't be given this area (the `store_members.areas` check doesn't list it). |
| SMS, mobile OTP | SMS off; no mobile OTP, now or later | SMS is an adapter stub that never sends; the manifest shows it as "Coming soon". No OTP flow. |
| Sender | The existing `amaze@powerproof.app` | Agent mail uses `MAIL_FROM`'s address, shown as "<Store> via PowerProof", reply-to the store's support email. No separate subdomain. |
| Brand | PowerProof Agents | |
| Credit cost | $5 for 60 requests, any agent | `CREDIT_PACK` in `lib/agents/define.ts`. One credit = one request. |
| Model | Gemini for now | Gemini is the default; the Anthropic adapter (plain HTTPS) is built behind the same interface and the admin switch. |
| Google Sheets | Build it | Picker + `drive.file` scope; daily refresh. |
| Existing lint failure | Fix it | `components/buyer/checkout-sheet.tsx`: the one existing file changed, approved. |

## Platform

- **An agent is a folder.** `agents/<id>/manifest.ts` (data only), `steps/`, `prompts/`, `templates/`, `ui/`, `tests/`. Registries are static, one line each: `agents/index.ts` (manifests, safe for pages), `agents/server.ts` (step code and prompts), `agents/ui.tsx` (optional screens). The test agent `agents/_test-digest` is registered only inside its own test.
- **Manifest drives the screens.** Catalog card, agent page, "how it works" diagram (`manifest.steps` + `howItWorks`), sample, safeguards (`highlights`), wizard data step heading, settings form (`setup`), credit costs, consents, metrics with tap-to-explain text, FAQ. `defineAgent` validates it with zod at import, so a broken manifest fails tests and the build.
- **Steps only reach what the manifest declares.** `guardCtx` limits a step to its declared connectors, action kinds, credit reasons and its own tables (`dataPrefix`, e.g. `chaser_`). Steps can't set prices: `credits.charge(reason)` looks the cost up in the manifest.
- **Agent screens without new routes.** `/agents/my/<instance>/<view>/…` is one catch-all that renders `AGENT_UI[agent].views[view]`.
- **Pages import `@/lib/api/agents`.** `lib/api/index.ts` can't be edited, so the agents' door is a sibling file; queries live in `lib/api/live/agents.ts`, types in `lib/types/agents.ts`.
- **Reads through RLS, writes through routes.** The browser only gets SELECT on agent tables (`store_can(store_id, 'agents')` or `is_admin()`). Every write is a server route that checks access first, then writes with the service key pinned to that store (`storeDb`).
- **New tables' types** are a loose `AgentsDatabase` in `lib/agents-database.types.ts`, so `lib/database.types.ts` (generated) isn't touched. Regenerating it later will include the new tables too.

## Runtime

- **Scheduler:** `/api/cron/agents` (CRON_SECRET, same style as the other cron routes). Each tick: enqueue due jobs (keys make repeats harmless), claim up to 8 with `FOR UPDATE SKIP LOCKED` (`agent_claim_jobs`), run within 25 s, return. The claim also takes a per-instance lock, so two runs of one agent never overlap. "Run now" claims its own job by id (`agent_claim_job`) under the same lock.
- **Resumable runs:** each step's output is a checkpoint (`agent_run_steps`). A run cut short continues at that step on the next tick. Failures retry with exponential backoff (1 min doubling, max 1 h); after 5 attempts a job is **dead** and shows in Admin › Failures with Retry.
- **Kill switches:** global (runs, sending), per agent (`agent_catalog.enabled`), per instance (owner Pause; staff Suspend). The pipeline re-checks before every send.
- **Credits and messages in one transaction:** `agent_outbox_reserve` checks the idempotency key, opt-outs, the per-contact cap, the daily cap and the balance, then writes the outbox row and the charge together. A send that fails gives the credit back once (`agent_outbox_finish`). A skipped WhatsApp item does too. The ledger is append-only (trigger); the balance is always summed.
- **Trial end:** when credits reach zero, a trial instance becomes `trial_ended` (owner emailed once); a paid one pauses. Data is never deleted.
- **Dry run** is the same code with `dryRun`: the pipeline answers "would send", actions are collected for the preview, no credits are charged. Drafts it writes are kept (they're what will go out).

## Messaging

- One path: consent, agent running, channel on, valid recipient, sending window, then the database checks, then send, then log.
- Email via the existing `sendMail` helper (imported, unchanged) with a per-message env override for the display name. Every email ends with a signed unsubscribe link naming the message, not the address (`/agents/optout/<outboxId>.<sig>`); the page needs a tap (link scanners can't opt people out).
- WhatsApp is click-to-send: an action item with a `wa.me` link and "Reply STOP to opt out." The owner taps, sends in WhatsApp, comes back and marks it sent.
- Opt-outs are per store and channel, stored as a SHA-256 of the address; email and WhatsApp/SMS phone opt-outs both block. The owner can also mark a customer opted out.

## LLM

- One gateway (`lib/server/agents/llm/gateway.ts`), two providers. JSON answer `{subject, body}`, validated, one retry, 20 s timeout, then the static template.
- **The model never sees customer data.** It gets the stage, tone, language, channel and placeholder names only (`{{customer_name}}`, `{{amount}}`, …). The app fills the facts afterwards and checks every fact is present. Wording with digits of its own (amounts, dates, deadlines), unknown placeholders, forbidden phrases or the wrong length is refused. So prompt injection through customer names or notes can't reach the model (tested).
- **Cached per store** by stage × tone × language × channel × prompt version: at most 32 model calls per store, ever, for Payment Chaser (the brief said one per customer per stage; this is stricter and cheaper).
- Tokens are metered per store and agent (`agent_llm_usage`) for the margin view.
- The drafting system prompt is the founder's text, unchanged (`agents/payment-chaser/prompts/reminder.ts`).

## Payment Chaser

- **Reminder key** = customer + stage + the chase's start (the oldest overdue due date). It can only ever be sent once; a new chase (after everything was paid) starts at stage 1 again. The brief said "store + customer + stage + date"; the chase start is the date that keeps re-runs on later days from repeating a stage.
- **One message per customer per stage**, grouping all their overdue invoices. Channel: email when the customer has one and email is on (it sends itself), else WhatsApp. Stages 1–2 use the owner's tone; 3–4 are firm (still polite).
- **Facts are refreshed just before sending.** A part payment updates the amount; a paid invoice stops the reminder (also at once when marked paid: drafts close and queued WhatsApp items leave the queue with their credit back). If the owner edited a draft and the amounts changed since, it waits for their approval instead of sending.
- **Imports:** parsed in the browser (preview, column mapping), re-checked on the server. Customers matched by mobile, email, then name. Re-uploads update by invoice number; an invoice the file shows fully paid is marked paid; one that disappeared from a full upload is listed for the owner to confirm (never auto-paid). The owner's own statuses (paused, disputed, written off) are kept.
- **XLSX without a dependency:** `lib/agents/xlsx.ts` unzips with the platform's `DecompressionStream` and reads the first sheet's XML. Dates arrive as Excel serials, which the parser understands.
- **No `chaser_rules`, `chaser_templates`, `chaser_reports` tables:** rules are the instance's settings (drawn from the manifest), static templates live with the agent's code (versioned and tested), reports use the platform's `agent_reports`.
- **"Paid after a reminder"** = marked paid within 14 days after a reminder that included it went out. Never "recovered by us".
- **Weekly report:** Monday 9:00 India time, React Email (`emails/agents/agent-emails.tsx`), recorded once per instance and week; skipped when there's nothing to say.

## Google Sheets

- Google Identity Services popup code flow (`redirect_uri: postmessage`) → the server swaps the code for tokens; the refresh token is sealed with the app's existing AES-256-GCM helper (`lib/server/integrations.ts`, imported unchanged; key `INTEGRATIONS_KEY`, else derived from the service key). The browser only ever gets a short-lived access token, because Google's Picker needs one.
- The connection belongs to the store and can be linked to any agent that declares `google_sheets` (done-when #4). A refresh that fails with `invalid_grant`/403 marks it `needs_reauth`, pauses only the linked agents, shows a banner and emails the owner once; fixing it switches them back on.

## Security

- Secrets never reach the browser, logs or `vars`. Logs carry counts and ids; addresses are masked (`+91••••••3210`).
- Rate limits (per Worker instance, the app's existing `allow`): demand 10/h per address, opt-out 30/h, imports 20/h per user. Uploads: 5 MB, 5,000 rows, 40 columns, 500 characters a cell.
- Exports guard against spreadsheet formulas (`safeCell`).
- Admin: every call re-checks `is_admin()`; every change and every read-only store view is written to `agent_audit_log`. Contacts are masked in admin lists.

## Database (live, 24 Oct 2026)

- The live migration history already used 049–058 (not in the repo), so the agents' migrations are **059–061**. Applied to the live PowerProofPro project with the founder's approval on 24 Oct 2026.
- `supabase/tests/agents_rls.sql` ran on live inside one transaction ended by a deliberate error, so nothing was kept (checked afterwards: no test users, stores or rows left). Every check passed: store A can't read store B; a Limited team member sees nothing; the sealed secret column is unreadable from the browser; browser writes and credit functions are refused; credits are idempotent, can't overdraw and the ledger is append-only; one outbox row per key, charged once and refunded on failure; one claimed job per instance at a time; signed-out visitors can read the catalog and file demand requests only.
- **Accepted security advisor findings** (intended): `agent_llm_cache` has RLS on and no policy (server-only, like `download_tokens`); `agent_request_demand` is callable signed out and signed in (the "I need this" form; it validates inside). No other agent function is callable from the browser.
- **Performance advisor:** 30 foreign keys on the new tables had no covering index. `062_agents_fk_indexes.sql` adds them; written, not yet applied. "Unused index" notes on the new tables are expected until there's data.

## Not built yet (and why)

- **Billing** (subscribe, verify, webhook, top-ups): deferred by the founder. When it comes: a separate Razorpay account or at least a separate webhook. Note: subscription events on the *same* Razorpay account also reach the existing `/api/webhooks/razorpay`, which answers 500 for subscriptions it doesn't know; Razorpay retries and can disable that webhook. A separate account avoids it.
- **SMS:** off until a provider and DLT registration.
- **Legal:** `/agents/terms` is a clearly marked draft. A lawyer must review it and the messaging rules (DPDP Act, telecom rules) before real customers.

## Waiting on the founder (existing files)

These need a one-line change to an existing file; nothing was changed without a yes:

1. `worker.ts`: add `"agents"` to the cron job list, or the scheduler never runs in production.
2. `lib/nav/config.ts`: an "Agents" item (owner/admin) in the creator sidebar, and one under Admin. Until then the pages are reachable by address only.
3. `.env.example`: the new names (see `docs/agents/ENV.md`).

## Questions for the founder

1. Is the margin view's cost table right? Defaults: Gemini $0.30/$2.50 per million tokens in/out, Anthropic $1/$5, email $0.0009, $1 = ₹84. Editable in `agent_platform_settings.cost_rates`.
2. Trial credits are per store and agent. Someone could make a second store for 25 more. Accept for v1?
3. When someone opts out by email, should their WhatsApp be blocked too? Currently only the channel they used (plus SMS/WhatsApp are treated as one).
