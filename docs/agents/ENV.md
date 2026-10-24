# PowerProof Agents: settings and accounts

Names only, never values. Secrets go in Cloudflare as **Secrets** (`npx wrangler secret put NAME`) and in `.env.local` for development. Public `NEXT_PUBLIC_*` values are baked in at build time.

| Name | Kind | Needed for | Notes |
| --- | --- | --- | --- |
| `CRON_SECRET` | secret (exists) | The scheduler | Already set for the other cron routes. Also needs `worker.ts` to call `/api/cron/agents` (waiting on approval). |
| `SUPABASE_SERVICE_ROLE_KEY` | secret (exists) | Every agent write | |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | secret / var (exist) | Drafting | Without a key, reminders use the static templates. |
| `ANTHROPIC_API_KEY` | secret (new, optional) | Anthropic as the model | Only if you switch Admin › Agents › Model provider to Anthropic. `ANTHROPIC_MODEL` optional. |
| `RESEND_API_KEY`, `MAIL_FROM` | secret / var (exist) | Agent email | Agent mail is sent from `MAIL_FROM`'s address (amaze@powerproof.app) as "<Store> via PowerProof". |
| `INTEGRATIONS_KEY` | secret (exists, optional) | Sealing Google tokens | Reused from the store integrations. Without it, a key is derived from the service key. |
| `AGENTS_VAULT_KEY` | secret (new, optional) | Signing opt-out links | Falls back to `INTEGRATIONS_KEY`, then the service key. Set it if you want agents' signing key separate. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | public (new) | Google Sheets | OAuth client (Web). Authorised JavaScript origin: your site. |
| `GOOGLE_CLIENT_SECRET` | secret (new) | Google Sheets | |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | public (new) | Google Picker | Restrict it to the Picker API and your site. |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | public (new) | Google Picker | The Cloud project **number**; lets the app open the file the owner picks with `drive.file`. |
| `NEXT_PUBLIC_AGENTS_SUPPORT_WHATSAPP` | public (new) | Help tab | Your WhatsApp number with country code, digits only (e.g. 919876543210). Hidden when unset. |

## Accounts to set up

1. **Supabase:** apply `supabase/migrations/059_agents_platform.sql`, `060_payment_chaser.sql`, `061_agents_seed.sql` (on a branch first), run `supabase/tests/agents_rls.sql` there, run the security advisors, then regenerate `lib/database.types.ts`.
2. **Google Cloud:** a project with the Google Sheets API and Google Picker API on; OAuth consent screen with the `drive.file` scope (non-sensitive); a Web OAuth client; an API key.
3. **Anthropic** (optional): an API key.
4. **Razorpay** (later, for billing): ideally a separate account for agents, its own plans and webhook secret.

## Same .env.local on every machine (encrypted sync)

`.env.local` never goes to git in plain text (the repo is public, and `.gitignore` plus `.githooks/check-env.mjs` stop it). Instead an encrypted copy, `secrets/env.local.enc`, is committed:

- **Changed a key?** `node scripts/env-sync.mjs push` (encrypts, commits that one file, pushes).
- **On another machine:** `node scripts/env-sync.mjs pull` (pulls, decrypts into `.env.local`, keeps the old one as `.env.local.bak`, lists which names changed). Restart `npm run dev`.
- **Check:** `node scripts/env-sync.mjs status`.
- **One-time per machine:** copy the key file `%USERPROFILE%\.powerproof\env.key` (Windows) or `~/.powerproof/env.key` (Mac/Linux) from a machine that has it, via USB or a password manager, never git or chat. Without it the encrypted file can't be opened. If the key ever leaks, make a new one (delete the file, push again) and rotate the secrets.

### …and on Cloudflare, automatically

`.github/workflows/cloudflare-secrets.yml` runs whenever `secrets/env.local.enc` changes on `master` (so after every `env-sync push`). It decrypts the copy, takes the server secrets only (not `NEXT_PUBLIC_*`, not names already in `wrangler.jsonc` `vars`, not empty values) and sets them on the `powerproof-pro` Worker with `wrangler secret bulk`. No change to the file, no run, and Cloudflare stays as it is. It never deletes a secret: remove one by hand in the dashboard. It can also be run by hand from GitHub → Actions → Cloudflare secrets → Run workflow.

One-time setup, GitHub → Settings → Secrets and variables → Actions → New repository secret:
- `POWERPROOF_ENV_KEY`: the contents of your `env.key` file.
- `CLOUDFLARE_SECRETS_TOKEN`: a Cloudflare **user** API token (My Profile → API Tokens) with **Workers Scripts: Edit** on your account.

Public values (`NEXT_PUBLIC_*`, `MAIL_FROM`, …) still live in `wrangler.jsonc` `vars`; change them there.
