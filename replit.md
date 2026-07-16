# Know Your Bite — Replit notes

Professional web workspace for registered dietitians: client CRM & assessments,
USDA-backed recipe library, meal planning, AI assistant, branded PDF exports.
EN / RO / HU. See `README.md`, `ARCHITECTURE.md`, `IMPLEMENTATION-ROADMAP.md`.

## Project overview

- npm-workspaces monorepo: `apps/server` (Express + Drizzle), `apps/web`
  (React 18 + Vite), `packages/domain|shared|i18n`, `e2e/` (Playwright).
- Single port: Express on 5000 serves the API and the web client (Vite
  middleware in dev, static in prod).
- Database: Replit PostgreSQL via `DATABASE_URL` (auto-set). Schema synced with
  `npm run db:push` (Drizzle).
- Secrets: `SESSION_SECRET` (required), `DATABASE_URL` (auto),
  `ANTHROPIC_API_KEY` (AI features), `USDA_API_KEY` (recipes, M3+).

## How to run

- **Dev** workflow → `npm run dev` (port 5000).
- **Checks** workflow → `npm run check` (typecheck + lint + i18n parity + tests).
- After schema changes: `npm run db:push`.
- DB integration tests are skipped unless `RUN_DB_TESTS` is set.

## Replit-specific notes (July 2026 setup)

- `vitest`/`@vitest/coverage-v8` were bumped from 2.1.x to ^3.2.4 because all
  2.1.x tarballs are blocked by Replit's package security policy.
- ESLint ignores `.local/`, `.agents/`, `.cache/` (Replit tooling dirs).

## User preferences

(none recorded yet)
