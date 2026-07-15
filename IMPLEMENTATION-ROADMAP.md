# Know Your Bite — Implementation Roadmap

> **Purpose.** This is the build order and method for the "Know Your Bite" nutritionist platform. It answers the user's two questions directly — *in what order do we implement things* and *how do we build this app* — with safety, multi-tenant isolation, immediate bug-fixing, and automated testing baked in from the first commit, all on Replit. It is subordinate to ADR-000 and the architecture sections; where anything here conflicts with the ADR, the ADR wins.
>
> **North star.** Every milestone ships a **thin vertical slice that is production-shaped from day one**: schema → migration → tenant-scoped repo → ts-rest contract → router → service → UI → tests → green CI. We never build a "layer" horizontally and wire it up later. We build the smallest end-to-end thing that works, prove it with tests, then widen it.

---

## Part A — Guiding Principles

These are the rules every milestone obeys. They are not aspirational; they are enforced by CI gates and the Definition of Done.

1. **Vertical slices, never horizontal layers.** A feature is "done" only when a user can exercise it end-to-end through the real UI against the real DB with tests green. We would rather ship *create-one-client, list-clients* fully than ship "the whole clients backend" with no UI.

2. **Test-first for anything with a defined answer.** All `packages/domain` clinical math is written test-first against reference-value tables (Harris-Benedict, macros, roll-ups, scaling). Bugs are always reproduced with a failing test before the fix (see Part D). We do not chase 100% everywhere — we chase **≥90% on `packages/domain`** (where correctness is life-adjacent) and **≥70% on routes/services**, and we cover every *invariant* (tenant isolation, recipe integrity, AI propose-only) exhaustively regardless of line count.

3. **Multi-tenant isolation from minute one — structural, not conventional.** The very first data-bearing table carries `tenant_id`, goes through the tenant-scoped repository, and is guarded by RLS. The **cross-tenant → 404 (never 403)** integration test exists for the *first* endpoint we ever write and for *every* endpoint thereafter. Isolation is never "added later."

4. **CI is always green; `main` is always deployable.** A red `main` is a stop-the-line event. We deploy to the Replit Reserved VM only from a green `main`. Migrations are forward-only (`drizzle-kit generate` committed → `migrate` on deploy); `push` is banned against anything shared.

5. **Small PRs.** One vertical slice or one milestone-sub-step per PR. A PR that can't be reviewed in ~20 minutes is too big. Every PR must independently satisfy the Definition of Done — no "I'll add tests in a follow-up."

6. **Deterministic before AI, always.** For any feature that has both a computed number and an AI narrative, the deterministic path is built, tested, and shippable *first*. AI is layered on as a propose-only, gracefully-degrading enhancement. The app must be fully usable with the Anthropic API turned off.

7. **The Definition of Done is a merge gate, not a wish.** (Reproduced in full in Part E.) Zod at every boundary; unit tests for new domain logic; integration + cross-tenant 404 per endpoint; component/E2E for user flows; all three locales present + no hardcoded strings; a11y (jsx-a11y clean, keyboard DnD); zero `tsc`/ESLint errors; coverage held; AI outputs schema-validated/propose-only/audited; forward-only migration; soft-delete respected; tenant-scoped composite index on new tables.

8. **Secrets fail fast.** The process refuses to boot if a required Secret is missing. No half-configured runtime, ever.

---

## Part B — Milestone 0: Project Foundation

**This is what we build first, before any product feature.** M0 is the entire walking skeleton: a deployable, tested, tenant-isolated, internationalized, branded, authenticated empty app on Replit with green CI. Nothing in M0 is a product module — it is the rails every product module rides on. M0 is not "done" until a user can register, verify, log in, land in a branded empty shell in their chosen language, and one smoke E2E proves it, with CI enforcing every gate.

We build M0 as an ordered sequence of small PRs. Each sub-step ends green.

### M0.1 — Monorepo scaffold on Replit
- **Tasks:** npm workspaces root (`apps/web`, `apps/server`, `packages/shared`, `packages/domain`, `packages/i18n`). `tsconfig.base.json` + solution `tsconfig.json` with project references (enables `tsc -b` and enforces the acyclic dependency graph). `.replit` (Reserved VM target, `nodejs-20` + `postgresql-16` modules, port 5000 → 80), `replit.nix` pinning Node 20. Single committed `package-lock.json`.
- **DoD:** `npm install` clean; `tsc -b` passes on empty packages; app boots to a placeholder `GET /healthz` returning `{status:'ok'}` on the Reserved VM.

### M0.2 — Tooling, lint, format, boundaries
- **Tasks:** ESLint flat config (typescript-eslint, react-hooks, jsx-a11y, import) **with `import/no-restricted-paths` boundary zones** (domain is pure; web can't import server; routers can't import Drizzle). Prettier. semgrep config. husky + lint-staged pre-commit (lint + format staged, typecheck).
- **Tests to write:** a deliberate boundary-violation file to confirm the lint zone *fails* (then delete it).
- **DoD:** `npm run lint` and `npm run typecheck` green; a domain→server import is a lint error.

### M0.3 — Test harness + first CI
- **Tasks:** Vitest workspace (three projects: `domain` node, `server` node, `web` jsdom) + Testing Library + jsdom + MSW skeleton. Playwright config. `.github/workflows/ci.yml` running: install → typecheck → lint → unit → (integration placeholder) → build. Coverage reporting wired (thresholds set low initially, ratcheted up as domain code lands).
- **Tests to write:** one trivial passing unit test per Vitest project to prove the harness runs in CI.
- **DoD:** CI is a **required merge gate** and is green on an otherwise-empty repo.

### M0.4 — DB + Drizzle + migrations + Neon
- **Tasks:** `@neondatabase/serverless` pooled (`-pooler`) `Pool`, `pool max = 3`. Drizzle schema dir under `apps/server/src/db/schema`. `drizzle.config.ts` → `migrations/`. First migration `0000_init`: enable `pg_trgm` + `unaccent`, install `uuidv7()` SQL function. Column helpers (`pk`, `tenantId`, `timestamps`, `softDelete`). Integration-test DB harness: Neon branch per CI run, each test in a rolled-back transaction; pglite for fast local.
- **Tests to write:** an integration test that opens a tx, writes/reads a throwaway row, rolls back, and confirms isolation.
- **DoD:** `drizzle-kit generate` → `migrate` runs on deploy; integration harness green in CI against a real Neon branch.

### M0.5 — Env/secrets (fail-fast)
- **Tasks:** `packages/shared` server-env Zod schema (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `USDA_API_KEY`, `SESSION_SECRET`, optional `SENTRY_DSN`). `apps/server/src/config/env.ts` parses at boot and `process.exit(1)` on failure. `USDA_API_KEY` refined to reject `DEMO_KEY`. `.env.example` documents each. Secrets set in both Replit Workspace and Deployment.
- **Tests to write:** unit test that a missing/`DEMO_KEY` secret fails the schema.
- **DoD:** booting without a secret crashes loudly with a clear message; CI covers the schema.

### M0.6 — Design system, brand tokens, app shell
- **Tasks (read the Design Protocol first):** Tailwind + shadcn/ui "new-york" + lucide-react. Brand tokens in `tokens.css` (gold `hsl(43 74% 52%)`, olive `hsl(88 24% 53%)`, warm-brown text/dark base, 8px radius, restrained shadows) for **light + dark**, with the pre-first-paint theme script to avoid flash. Self-hosted Inter woff2 (no CDN). App shell: sidebar (coconut badge lockup + 5 nav items, post-MVP items stubbed "coming soon") + topbar + card content area. Theme toggle persisting to localStorage (and later the settings row).
- **Tests to write:** component test that the shell renders both themes; Playwright visual snapshot of the empty shell in light + dark.
- **DoD:** the empty authenticated shell matches the brand; theme toggles without flash; a11y clean.

### M0.7 — i18n skeleton
- **Tasks:** `packages/i18n` with EN/RO/HU folders, namespaces (`common, clients, recipes, planner, settings`), i18next + react-i18next + i18next-icu, lazy per-locale loading, `format.ts` (Intl number/date helpers shared web+server). CI i18n guard script: key parity across all three locales, no-hardcoded-string lint, ICU plural correctness (RO `one/few/other`).
- **Tests to write:** i18n guard fails on a deliberately missing RO key (then fix); ICU plural unit test for RO counts 1/2/5/20.
- **DoD:** every shell string comes from `t()`; the CI i18n guard is a merge gate and green.

### M0.8 — Auth + multi-tenant baseline (the keystone of M0)
- **Tasks:** `users` + `auth_tokens` tables (UUIDv7, `tenant_id === users.id`, MFA columns provisioned but off). passport-local + **argon2id**; email verify + password reset via hashed single-use expiring tokens; anti-enumeration (uniform responses); per-account lockout + IP/email rate limit. `express-session` + `connect-pg-simple` (Postgres store; `memorystore` banned); `Secure`+`HttpOnly`+`SameSite=Lax`; session regeneration on login; idle + absolute timeouts. helmet + strict CSP. CSRF on state-changing verbs. **The tenant enforcement trio:** (1) `requireAuth` deriving `tenantId` *only* from the session, (2) the tenant-scoped repository factory that injects `tenant_id` on every read/write, (3) RLS policies + `SET LOCAL app.tenant_id` inside a per-request transaction. Central error middleware → uniform envelope with the stable `code` enum; cross-tenant → 404.
- **Tests to write:**
  - *Unit:* argon2 hash/verify; password policy Zod; token hashing single-use.
  - *Integration:* register→verify→login→session; login regenerates session id; reset invalidates all sessions; brute-force lockout; **the canonical cross-tenant 404 test** (seed two tenants, B requests A's user-scoped resource → 404, asserted *not* 403). A shared helper is built here that will generate this test for every future endpoint.
  - *Component:* login/register/reset forms with RHF + shared Zod; server `VALIDATION_ERROR` mapped back onto fields.
- **Risks:** session/cookie behavior behind the Replit TLS proxy (`trust proxy`); GUC leak across pooled connections (mitigated by `SET LOCAL`/`set_config(...,true)` inside the request tx — write a test that proves the GUC resets between two pooled requests).
- **DoD:** a real user can self-register, verify, log in, and reach the shell; the tenant trio is provably fail-closed; cross-tenant 404 helper exists and is green.

### M0.9 — Health-check + one smoke E2E
- **Tasks:** `GET /healthz` (DB-free readiness). Playwright smoke: load app → register → verify (token surfaced via test hook/MSW mail) → login → see the branded empty shell in a chosen locale → logout. Sentry (browser+node, EU, `beforeSend` PII scrub) + pino (`requestId`+`tenantId`, never clinical values) wired.
- **DoD:** the smoke E2E runs in CI (mocked mail), green; deploy-from-green-`main` to the Reserved VM verified once, end-to-end.

**Milestone 0 exit criteria (all true):** deployable Replit app; green required CI with all gates active (typecheck, lint, unit, integration, i18n guard, semgrep, one E2E); auth + tenant isolation + RLS proven; brand shell in light/dark; EN/RO/HU switchable; secrets fail-fast; the cross-tenant-404 and bug-fix rituals are established. **From here, every product module is "just another vertical slice on these rails."**

---

## Part C — Product Milestones (ordered vertical slices)

Each milestone is delivered as several small PRs, each a thin end-to-end slice. Order within a milestone is always: **domain math (test-first) → schema+migration → contract → repo → service → router → UI → deterministic tests green → AI enhancement (propose-only) → AI-invariant tests green.**

---

### Milestone 1 — Clients / CRM

**Goal.** A dietitian can create, view, edit, soft-delete, list, search, and photo-attach clients — fully tenant-isolated. This is the simplest full CRUD module and it *hardens the rails* (repository pattern, cursor pagination, filtering, uploads, cross-tenant tests) that every later module reuses.

**Key tasks.**
- `clients` table (`tenant_id`, name/phone/email, `client_since`, notes, `profile_image_object_id`, timestamps, soft-delete) + tenant-leading composite indexes + `unaccent`/trgm search index.
- ts-rest `clientsContract`: list (cursor pagination, `q`/`clientType`/sort filters), create (idempotency-key), get, patch, soft-delete, photo upload (multipart → sharp re-encode/EXIF-strip/reject-SVG → Object Storage, private, signed-URL fetch), GDPR export + erasure endpoints (erasure schema-provisioned; full purge wired).
- Web: client list page (virtualized, prefetch-on-hover), client detail shell, create/edit forms (RHF + shared Zod), photo upload with signed-URL display.

**Tests to write.**
- *Integration:* every endpoint happy path; boundary `VALIDATION_ERROR`; **cross-tenant 404 for every endpoint** (via the M0.8 helper); soft-delete excluded from lists; pagination stable under concurrent inserts; upload rejects SVG/oversized/non-image (magic-byte).
- *Component:* list filtering/search; create form validation + server-field-error mapping.
- *E2E:* login → create client → see it in list → open detail.

**Risks.** Object Storage signed-URL authz (signer must reject a key whose tenant segment ≠ session tenant — test it); EXIF/PII leakage (assert sharp strips it).

**Definition of Done.** Full CRUD + search + photo, tenant-isolated with 404 tests, uploads hardened, all three locales, a11y clean, green CI, deployed.

---

### Milestone 2 — Assessments + Finish-with-AI

**Goal.** A dietitian fills a schema-driven assessment (Standard/Sports), clicks "Finish with AI," reviews a proposal (deterministic maintenance TDEE + macros shown authoritatively, AI narrative + *bounded* calorie-adjustment shown as an editable suggestion), and approves human-final targets. This introduces the **deterministic↔LLM boundary** and the **universal AI propose-only pipeline** — the two hardest safety invariants — on the simplest AI surface.

**Key tasks.**
- **First, test-first in `packages/domain`:** Harris-Benedict BMR (M/F) + activity-factor TDEE against a committed reference table; macro formulas (contract + property tests now; exact g/kg pinned when the owner supplies formulas — **flag D4 as blocking input**); nutrition validator. These land and hit ≥90% *before* any AI code.
- `client_assessments` (versioned envelope: first-class Harris-Benedict columns sex/age/height/weight/activity + per-type Zod-validated JSONB `payload`; lifecycle `unfinished → ai_proposed → completed → discarded`; soft-delete) + `assessment_targets` (deterministic BMR/TDEE + human-approved kcal/macros + `decision_summary` + approver).
- Schema-driven form engine: field registry mapping question descriptors → RHF shadcn controls; guarantees HB inputs always captured.
- AI pipeline (`runFeature`): pseudonymize (strip name/phone/email/photo — unit-tested fail-closed) → delimit untrusted notes → opus-4-8 tool-use → **server-side Zod re-validation** (`.strict()`, no numeric fields; bounded `percent` ±30 clamped) → persist **proposal + `ai_interactions` audit row** → return for review. Deterministic numbers returned regardless of AI outcome (graceful degradation → `UPSTREAM_UNAVAILABLE` + retry state).
- Web: assessment wizard (autosave draft), `FinishWithAiPanel` (deterministic values prefilled/editable; AI suggestion beside them, clearly labeled), approve → normal validated mutation writes final targets + records `humanDecision`.

**Tests to write.**
- *Unit:* HB/macros/validator reference tables + property tests; pseudonymize fail-closed.
- *Integration:* finish-with-ai returns deterministic block even when Anthropic (MSW) fails/times out; **malformed AI tool output is rejected before display and never persisted**; approve records `humanDecision ∈ {accepted,edited,rejected}` and writes only human values; cross-tenant 404 on every assessment endpoint; lifecycle guards (can't approve a non-`ai_proposed` assessment → `CONFLICT`).
- *Component:* wizard step logic; review panel shows deterministic TDEE authoritatively and AI adjustment as editable.
- *E2E:* fill assessment → Finish-with-AI (mocked) → edit a macro → approve → completed profile.

**Risks.** Owner hasn't supplied exact questions/macro formulas (D4) — mitigate with the schema-driven engine + formula seam so the real numbers drop in without re-architecting. LLM tempted to emit numbers — mitigated structurally (no numeric field in the tool schema).

**Definition of Done.** Deterministic targets correct and tested to ≥90%; AI is propose-only, audited, reviewable, degrades gracefully; malformed-output rejection proven; lifecycle enforced; green CI.

---

### Milestone 3 — USDA + Recipe Library + Nutrition + Allergens

**Goal.** A dietitian searches USDA foods, builds a recipe whose ingredients snapshot per-100g nutrients at add-time, sees ingredient/total/per-serving nutrition (all deterministic), gets a deterministic allergen floor + additive AI suggestions, and exports a scaled recipe PDF. This establishes **recipe integrity** (the product's hardest invariant) and the **USDA cache-first** pipeline.

**Key tasks.**
- USDA thin typed client (native fetch, key server-only, `X-Api-Key` header): `POST /foods/search` (Foundation+SR Legacy default; Branded behind toggle) and `GET /food/{fdcId}`; 429/5xx backoff, 8s timeout, degrade to cached-only. Global `usda_food_cache` (no tenant_id) write-through; short-TTL search-list cache; per-tenant rate limit on `/usda/*`.
- **Deterministic normalization in `packages/domain`/`usda/normalize.ts` (test-first):** nutrient-number extraction, kJ→kcal, Branded per-serving→per-100g, unit conversion, plausibility validator (≤900 kcal/100g, Atwater ±30%) — fail-closed before persist.
- `recipes` (+ derived cached totals, recomputed from ingredients), `recipe_ingredients` (**frozen `nutrients_per_100g` snapshot** + `fdcId` for explicit refresh + `canonical_name_en`; `CHECK` kcal≤900), `recipe_allergens` (deterministic|ai|dietitian, `is_confirmed`), categories + join. **No override table exists.**
- Roll-up functions (ingredient/total/per-serving) in `packages/domain`.
- Allergen floor (deterministic 7-major matcher on canonical English) + additive haiku-4-5 suggestions (schema has `additions` only, never `removals`).
- pdfmake server-side recipe export: user picks servings → deterministic scaling → template toggles + brand theme + Inter VFS (RO/HU diacritics) → Object Storage + `generated_documents` snapshot.
- Web: recipe dashboard (full filter set — the reference filtering case), recipe editor with debounced USDA type-ahead, three-level nutrition panels, allergen review, export dialog.

**Tests to write.**
- *Unit:* normalization + validator reference tables (incl. pure oil edge, branded conversion, kJ→kcal); roll-up identities (Σ ingredient == total; per-serving·servings == total); serving scaling round-trip.
- *Integration:* USDA cache-first (write-through on detail, no second upstream call); **snapshot immutability — mutating the USDA cache row leaves recipe nutrition byte-identical**; malformed/implausible USDA JSON rejected before persist; degrade-to-cached-only on USDA down; allergen floor deterministic-by-locale; AI allergen suggestion additive-only; cross-tenant 404 everywhere.
- *E2E + visual:* build recipe → nutrition renders → export PDF; golden PDF snapshot (EN/RO/HU + diacritics).

**Risks.** USDA quota/DEMO_KEY (banned; rate-limit + cache); branded unit weirdness (reject un-convertible units); PDF font/diacritic rendering (golden test).

**Definition of Done.** Recipe integrity structurally enforced and proven byte-stable; three-level nutrition deterministic; allergens floor+additive; scaled PDF with brand + i18n; cache-first + graceful degradation; green CI.

---

### Milestone 4 — Meal Planning (drag-and-drop + daily dashboard + AI chat + patient-friendly export)

**Goal (the flagship module).** A dietitian picks a client + period (Day/Week), creates meal windows, drags recipes into them (multiplier-only), adds USDA extras, watches a live nutrition dashboard, uses a streamed AI chat that can only propose `setServingMultiplier`/`addExtraFood`, generates patient-friendly wording, reviews technical-vs-friendly, and exports a frozen PDF. This is the largest milestone — build it as several slices.

**Slice order.**
1. **Plan tree + windows (no DnD yet):** `meal_plans` (period, snapshotted targets from latest completed `assessment_targets`, lifecycle Draft→Complete→Exported→Reopened/Duplicated), `meal_plan_days`, `meal_windows`, `meal_entries` (`recipe_id` + `serving_multiplier` only, `CHECK >0`), `meal_extras` (frozen snapshot). CRUD via ts-rest; every leaf carries `tenant_id`, verified on the leaf. Manual add-entry endpoint first.
2. **Live nutrition dashboard:** day/week roll-ups as a TanStack Query derived selector over the entries cache using `packages/domain` functions — target vs current per day, updates instantly.
3. **Drag-and-drop:** `@dnd-kit` (`DndContext`, `DragOverlay`, `KeyboardSensor` — keyboard DnD is a DoD gate), optimistic add via `setQueryData` + rollback + reconcile. Multiplier segmented control `{1,1.25,1.5,2}` only. **No UI control can address ingredient grams.** Calendar TimeAxis 08:00–20:00 with "entire day / only-with-meals" filter.
4. **AI planning chat (sonnet-5, streamed SSE):** read-only nutritional context (pseudonymized) + delimited notes; recommendations returned as Zod-validated `PlannerApplyAction` proposals rendered as "Apply" buttons routing through the *same* validated mutation. Server validator rejects any shape outside the two allowed tools.
5. **Patient-friendly export (haiku-4-5):** deterministic gram/ml + household-measure hints → AI phrases *around* fixed numbers (never invents quantities; every `sourceRef` verified); persisted proposals + audit. Manual review screen (left technical / right editable AI wording; nothing locked; export blocked until every meal reviewed). Export freezes `generated_documents` snapshot → PDF.
6. **History:** plans attached to client; reopen/duplicate operate on snapshots; documents list via signed URLs.

**Tests to write.**
- *Unit:* day/week roll-ups incl. extras; scaling.
- *Integration:* multiplier `CHECK` + allowed-set; **AI-invariant — applying any suggestion changes only `serving_multiplier`, ingredient amounts byte-identical**; apply-proposal rejects any non-`{setServingMultiplier,addExtraFood}` shape; no AI path auto-commits; export blocked with unreviewed wording (`422 REVIEW_INCOMPLETE`); snapshot immutability (editing a recipe after export doesn't change the delivered PDF); nested-ownership verified on leaf; cross-tenant 404 everywhere.
- *Component:* keyboard-operable DnD; dashboard live-update on drop; review screen editability.
- *E2E + visual:* build week plan via DnD → dashboard updates → AI chat apply (mocked) → patient review → export PDF (golden EN/RO/HU).

**Risks.** DnD smoothness + a11y (chose @dnd-kit for keyboard sensor); optimistic-update reconciliation drift (server confirms nutrition); AI attempting recipe mutation (structurally impossible — no schema shape, plus server validator + DB shape).

**Definition of Done.** Smooth + keyboard-accessible DnD; live deterministic dashboard; AI chat propose-only and audited; recipe integrity proven byte-stable under AI apply; review-before-export enforced; frozen export snapshots; green CI.

---

### Milestone 5 — Settings, Export Templates, i18n polish, USDA Translation Layer

**Goal.** A dietitian sets locale/units, manages reusable export templates, and food names display in HU/RO via the self-improving translation corpus — all display-only, never touching clinical logic.

**Key tasks.**
- `user_settings` (locale persisted server-side + drives UI and PDF language), profile settings.
- `export_templates` (scope recipe/meal_plan; show image/allergens/notes/nutrition/preparation/branding + clinic name/accent/logo; one default per scope; soft-delete) wired into both PDF builders.
- USDA food-name translation layer: global `food_name_translations` keyed by `fdcId` (`en/ro/hu`, `source ∈ curated|ai|dietitian`, `verified` flags). Cache-first resolution; on miss, haiku-4-5 proposes (Zod-revalidated, `verified=false`, audited) and UI **falls back to English immediately** with a "not yet translated" affordance. Dietitian review queue confirms → `source=dietitian`, saved back globally (self-improving). **Search + allergen logic always run on canonical English.**
- Full i18n sweep: remove any remaining hardcoded strings; ICU plurals audited; number/date/unit formatting via shared `Intl` helpers in UI and PDF.

**Tests to write.**
- *Integration:* translation miss → English + unverified flag, never blocks; malformed haiku output rejected; **immutability guard — translating/editing a food name leaves `recipe_ingredients.canonical_name_en` + snapshot byte-identical**; clinical-EN guard (allergen/search identical regardless of locale); translation table global but recipe/plan endpoints still 404 cross-tenant.
- *Component:* locale switch re-renders without reload; template toggles map to sections.
- *E2E + visual:* golden RO/HU/EN recipe + meal-plan PDFs (decimal comma, localized labels, unchanged authored prose).

**Risks.** Translation accidentally influencing clinical logic (prevented by architecture; asserted by clinical-EN guard); template/locale matrix explosion in PDFs (golden tests per locale).

**Definition of Done.** Locale + templates + translation corpus working; translations provably display-only; all three locales complete with no hardcoded strings; golden PDFs green; CI green.

---

## Part D — Bug-Fix Protocol (red-first, non-negotiable)

Every bug — clinical, tenancy, UI, upstream — follows the same ritual. No fix merges without a test that was red before it and green after.

1. **Reproduce.** Confirm the bug manually or from a report.
2. **Write the failing test at the lowest layer that exhibits it.**
   - Nutrition miscalculation → a `packages/domain` unit case (**and a new row in the reference-value table**).
   - Tenant leak → an integration cross-tenant test.
   - Wizard/dashboard glitch → a component test.
   - AI mis-behavior → an AI-invariant/MSW malformed test.
3. **Confirm it is red.** If it passes, it doesn't capture the bug — rewrite it.
4. **Apply the minimal fix.**
5. **Confirm green** — the new test and the full suite.
6. **Keep the test forever** as a permanent regression guard; it is never deleted with the fix.
7. **Clinical-math bugs must extend the committed reference table**, making that class of bug structurally unrepeatable.

A red `main` stops feature work until it's green again.

---

## Part E — Definition of Done (merge gate for every PR)

- [ ] Zod validation at every request boundary + on every USDA/Anthropic response.
- [ ] Unit tests for all new `packages/domain` logic; numeric cases added to reference tables.
- [ ] Integration test **+ cross-tenant 404 test** for every new endpoint.
- [ ] Component/E2E for user-facing flows.
- [ ] All three locales' keys present; no hardcoded strings.
- [ ] a11y pass (jsx-a11y clean; keyboard path for DnD).
- [ ] Zero `tsc` and zero ESLint errors; coverage thresholds held (domain ≥90%, routes/services ≥70%).
- [ ] AI outputs schema-validated, propose-only, reviewable, audit-logged; graceful degradation verified.
- [ ] Any schema change ships as a reviewed, reversible, forward-only migration (never `push`).
- [ ] Soft-delete respected; no new `CASCADE` hard-wipe on clinical entities.
- [ ] New tenant-scoped table has a `tenant_id`-leading composite index for its default query.

---

## Part F — Dependency-Ordering Rationale (why this order)

- **M0 before everything** because safety, isolation, and testing must be *structural from minute one*. Retrofitting tenant isolation, i18n, or a test harness onto a half-built app is exactly the "unsafe/unsustainable" outcome the owner forbade. M0 makes every later module a low-risk repetition of a proven pattern.
- **Auth/tenancy is the M0 keystone** because it defines the security context (`tenant_id`) every table, query, and test depends on. The cross-tenant-404 helper built here is reused by *every* subsequent endpoint.
- **Clients (M1) first among products** because it's the simplest full CRUD — it *battle-tests the rails* (repository, pagination, filtering, uploads, cross-tenant tests, GDPR) on low-risk data, and it's the entity every later module references (assessments belong to clients; plans belong to clients).
- **Assessments (M2) second** because it's the smallest surface on which to prove the two hardest safety boundaries — deterministic-vs-LLM and AI propose-only — before those patterns are needed under the pressure of the planner. It depends on Clients and produces the `assessment_targets` that meal-plan targets snapshot.
- **Recipes + USDA (M3) third** because the planner is meaningless without recipes, USDA integration, deterministic nutrition, and the recipe-integrity snapshot. Building recipe integrity here — in isolation — lets us prove byte-stability before the planner ever touches a recipe.
- **Meal Planning (M4) fourth** because it composes *everything upstream*: clients, assessment targets, recipes, USDA extras, deterministic roll-ups, and the AI propose-only pipeline. It cannot be built earlier because it depends on all of them.
- **Settings/templates/translation (M5) last** because export templates and the food-name corpus enhance existing recipe/plan exports rather than being blocked-on by them, and doing the full i18n/translation sweep last lets it cover every string the earlier modules introduced. (The i18n *skeleton* is in M0 so nothing is ever hardcoded in the meantime.)
- **Deterministic-before-AI within every milestone** so the app is always fully usable with AI off, and so the LLM is never on the critical path of a clinical number.

---

## Part G — Start Here: the very first coding session

Do these, in order, each as a tiny green-ending step (this is M0.1 → the start of M0.3):

1. **`npm init` the workspace root** with `workspaces: ["apps/*","packages/*"]`, `"type":"module"`, Node 20 engine pin. Create empty `apps/web`, `apps/server`, `packages/{shared,domain,i18n}` with package.json + tsconfig each.
2. **Add `tsconfig.base.json` + solution `tsconfig.json`** with project references. Run `tsc -b` → green on empty packages.
3. **Add `.replit` + `replit.nix`** (Reserved VM, nodejs-20 + postgresql-16, port 5000→80). Boot a one-line Express server exposing `GET /healthz` → `{status:'ok'}`. Confirm it serves on the Reserved VM.
4. **Add ESLint (with `import/no-restricted-paths` boundary zones) + Prettier + husky/lint-staged.** Prove the boundary rule by writing a domain→server import, watching lint fail, deleting it.
5. **Add Vitest workspace + one passing test per project**, and the GitHub Actions CI (`typecheck → lint → unit → build`). Make CI a **required** check. Land it green.
6. **Write the first real `packages/domain` code test-first: `bmrHarrisBenedict`**, with a committed reference-value table (♂ 80/180/30 → 1854.7). Red → implement → green. This establishes the test-first clinical-math discipline that carries the whole project.

At the end of session one you have a deployable, CI-gated, boundary-enforced monorepo on Replit with the first unit-tested clinical function — the smallest possible slice of the real thing, built the way the whole app will be built. Everything after is repetition of this rhythm at larger scope.
