# Know Your Bite

A professional web workspace for registered dietitians — client CRM & assessments,
a USDA-backed recipe library, drag-and-drop meal planning, an AI assistant, and
branded PDF exports, in English / Romanian / Hungarian. Runs on **Replit**.

- **What we're building:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Build order:** [`IMPLEMENTATION-ROADMAP.md`](IMPLEMENTATION-ROADMAP.md)
- **Look & feel (fixed brand):** [`Claude - Know Your Bite Design Protocol.md`](Claude%20-%20Know%20Your%20Bite%20Design%20Protocol.md)

---

## Current status — Milestone 0 (foundation)

This is the tested, branded, **authenticated** walking skeleton — not yet the
product features:

- ✅ npm-workspaces monorepo, TypeScript strict, ESLint (with module-boundary
  zones), Prettier, Vitest (multi-project), Playwright, GitHub Actions CI.
- ✅ `packages/domain` — pure, fully unit-tested clinical math (Harris–Benedict,
  macros, nutrition roll-ups, unit conversion, serving scaling, validator).
- ✅ `packages/shared` — API response envelope + error codes + fail-fast env
  schema + auth input schemas.
- ✅ `packages/i18n` — EN/RO/HU catalogs, i18next + ICU, key-parity guard.
- ✅ **Database** — Drizzle ORM + Neon Postgres, `users` + `auth_tokens` schema,
  app-generated UUIDv7 keys.
- ✅ **Auth + multi-tenancy** — email/password (argon2id), Postgres-backed
  sessions, register / login / logout / me, `tenant_id` per account, session
  regeneration on login.
- ✅ Express server: `/healthz`, `/api/v1`, single-port Vite integration.
- ✅ Branded React shell: auth-gated (login/register page), sidebar (coconut
  badge), topbar with user menu + logout, light/dark theme toggle, language
  switcher.
- ✅ **M1 — Clients / CRM** (first tenant-scoped module): `clients` table,
  reusable tenant-scoped repository, CRUD API (`/api/v1/clients`, create / list
  with search + type filter / get / update / soft-delete, cross-tenant → 404),
  web list + create/edit + detail pages, EN/RO/HU strings, tests (Zod + web
  component in CI; DB integration incl. the cross-tenant-404 test guarded behind
  `RUN_DB_TESTS`).

**Not yet (next up):** email verification / password reset / MFA / rate limiting,
RLS hardening; **M2 — Assessments + Finish-with-AI** (BLOCKED on the exact
Standard/Sports questions + macro formulas); then recipes, meal planning,
settings. See the roadmap.

---

## Run it on Replit

1. **Import** this repository into Replit (Create → Import from GitHub, or upload).
   The `.replit` config targets a Reserved VM with the `nodejs-20` and
   `postgresql-16` modules.
2. **Add a database:** open the **Database** tool and create a PostgreSQL DB.
   Replit sets the `DATABASE_URL` secret automatically. (The M0 skeleton doesn't
   query it yet, but the env schema requires it to be present.)
3. **Set secrets** (Tools → Secrets):
   - `SESSION_SECRET` — any long random string (≥ 32 chars). Generate one with:
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `DATABASE_URL` is provided by step 2. `ANTHROPIC_API_KEY` / `USDA_API_KEY`
     are only needed later (M2/M3); leave blank for now.
4. **Install, create tables, run:** in the Shell:
   ```bash
   npm install --omit=dev   # runtime deps only; skips test tooling
   npm run db:push          # creates the users / auth_tokens / clients tables
   npm run dev
   ```
   Open the web preview — you'll land on the branded login/register page.
   Create an account, and you're in the app shell. The server logs
   `Know Your Bite listening on http://localhost:5000`.

   > **Why `--omit=dev` on Replit?** Replit's package firewall blocks some test
   > tooling (e.g. flagged `vitest` versions). Those are only needed for tests,
   > which run in GitHub Actions CI — not on the runtime host. Everything needed
   > to build and run the app lives in `dependencies`, so `--omit=dev` installs a
   > clean, running app. Run the full test suite locally or in CI with a plain
   > `npm install`.

### Verify everything is green

```bash
npm run typecheck   # tsc across all workspaces
npm run lint        # eslint incl. module-boundary rules
npm run i18n:check  # EN/RO/HU key parity
npm run test        # domain + shared + i18n + server + web unit/component tests
npm run test:e2e    # Playwright smoke (boots the app, toggles theme, switches language)
# or all at once (except e2e):
npm run check
```

If `npm run dev` exits immediately complaining about environment variables, that
is the **fail-fast** guard working — set `SESSION_SECRET` and `DATABASE_URL` and
retry.

---

## Repository layout

```
apps/
  server/   Express API + single-port web serving (Vite dev / static prod)
  web/      React 18 + Vite SPA (brand shell, i18n, theming)
packages/
  domain/   Pure deterministic clinical & nutrition math (no I/O, no LLM)
  shared/   Zod env schema + API envelope + error codes (client/server contract)
  i18n/     EN/RO/HU catalogs + i18next/ICU setup + format helpers
e2e/        Playwright smoke tests
scripts/    CI helpers (i18n guard)
```

Import boundaries are enforced by ESLint: `domain` stays pure, `web` cannot
import `server`, and vice-versa.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app (server + Vite) on port 5000 |
| `npm run build` | Build the web client for production |
| `npm run start` | Production server (serves the built client + API) |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` / `npm run format` | Lint / format |
| `npm run test` | Run all unit/integration/component tests once |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run i18n:check` | Fail if EN/RO/HU drift out of key parity |
| `npm run db:push` | Sync the Drizzle schema to your Postgres (dev) |
| `npm run db:generate` / `db:migrate` | Generate / apply SQL migrations (prod) |
| `npm run check` | typecheck + lint + i18n + tests |

## Notes

- **Node 20** is required (`engines`). The Replit `nodejs-20` module provides it.
- Deterministic math lives only in `packages/domain`; the AI layer (later) only
  ever *proposes* values a dietitian reviews.
- The old Replit export is archived at `Replit Exports/KnowYourBite.zip` (git-ignored).
