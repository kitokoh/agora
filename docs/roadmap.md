# Agora — Delivery Roadmap

**Owner**: architect | **Updated**: 2026-08-14 | **Cadence**: milestones = 2-week sprints, multi-agent parallel execution

Each milestone is a GitHub **milestone** + an **epic issue** with a task
checklist. Milestones M0–M1 have fully broken-down issues; M2–M6 epics are
decomposed by agents via the Spec Kit loop (`/speckit.specify → plan →
tasks → taskstoissues`) at the start of each milestone.

---

## M0 — Fondations (2026-08-14 → 2026-08-28) `Foundations`

> What: the machine that builds the machine.
> Exit criteria: **`pnpm dev` runs API + web locally; CI green; staging deployable.**

- Monorepo skeleton (turbo/pnpm/workspaces/config presets)
- `services/api` bootstrap (Fastify, config, pino, health, graceful shutdown)
- `apps/web` bootstrap (Next.js 15)
- `apps/dashboard` + `apps/admin` bootstrap
- `packages/db` (Prisma, schema-per-module, first migration)
- `packages/contracts` (Zod → OpenAPI pipeline)
- Local infra `docker compose` (pg/redis/minio/meili) + seed scripts
- CI/CD pipelines, branch protection, Changesets, Dependabot, CodeQL
- Observability baseline (OTel, healthz/readyz, Sentry, dashboards)
- Security baseline (headers, rate-limit plugin, secret scanning)
- ADR ratification sweep + repo docs final pass

## M1 — Identité & Onboarding (2026-08-29 → 2026-09-11) `Identity`

> What: who is who, and how a seller opens a shop.
> Exit criteria: **signup → email verify → login → create shop, end-to-end on staging.**

- Identity module: users, Argon2id, sessions + refresh rotation, MFA (TOTP)
- Social OAuth (Google/Facebook/Apple), account linking
- RBAC: roles, permissions matrix, endpoint guards, audit events
- Seller onboarding: profile, KYC draft, shop creation
- Notification templates (welcome, verify, magic link), email delivery
- Rate limiting + login anomaly alerts
- E2E: full onboarding journey; Playwright suite

## M2 — Catalogue & Recherche (2026-09-12 → 2026-09-25) `Catalog`

> What: shops have products, buyers find them.
> Exit criteria: **seller publishes a product with images; buyer finds it via search in < 1 s.**

- Catalog module: products/variants/SKUs/categories/attributes
- Media pipeline: presigned upload, sharp processing, CDN, moderation hook
- Storefront rendering (shop pages on `web`)
- Search: Meilisearch indexer via outbox, faceted filters, typo tolerance
- Browse: category trees, sorting, pagination, SEO meta
- Seller dashboard: product CRUD, stock management, bulk import (CSV)

## M3 — Commerce (2026-09-26 → 2026-10-09) `Commerce`

> What: money moves, correctly.
> Exit criteria: **buyer pays; funds land in escrow with balanced ledger entries.**

- Cart (merge, TTL, price revalidation), checkout (addresses, shipping)
- Orders state machine + immutable order lines
- Payments module: Stripe PaymentIntents + webhooks, idempotency
- Finance module: double-entry ledger, escrow, commission split
- Order emails + buyer account order history
- Webhook out infra (seller integrations) v1

## M4 — Ops Vendeur (2026-10-10 → 2026-10-23) `Seller Ops`

> What: selling is a business, not a one-off.
> Exit criteria: **seller fulfills an order, sees analytics, receives a payout.**

- Fulfillment: shipping methods, labels, tracking webhooks
- Payouts: Stripe Connect onboarding, settlement schedules, payout history
- Seller analytics: GMV, orders, conversion, top products (read-model)
- Plans & billing: Free/Plus/Pro, Stripe subscriptions, plan gating
- Notifications center (in-app + email digests)
- Inventory: reservations, low-stock alerts, restock

## M5 — Confiance & Admin (2026-10-24 → 2026-11-06) `Trust`

> What: a marketplace people trust.
> Exit criteria: **full trust loop: review → dispute → resolution → refund, admin-instrumented.**

- Reviews & ratings (verified purchase only), moderation queue
- Disputes & chargebacks state machines + evidence
- KYC verification workflow (manual + provider)
- Admin console: shops, users, payouts approval, platform config
- GDPR: erasure, export, retention jobs
- Audit log query UI

## M6 — Lancement & Scale (2026-11-07 → 2026-11-20) `Launch`

> What: proven before people arrive.
> Exit criteria: **hardened, load-tested, monitored, launch runbook executed.**

- Load tests (10× launch target), perf fixes, capacity plan
- Pentest checklist + security hardening pass (ASVS L2)
- SEO: sitemaps, OG, structured data; PWA basics; Core Web Vitals budgets
- Feature flags, canary config, launch runbook + rollback drill
- Backup/DR drills, cost review, SLA/SLO finalization
- Beta cohort + feedback loop; public launch

---

## Operating rhythm

- **Monday**: milestone kickoff — agents decompose epic via Spec Kit.
- **Daily**: issue status updates on the project board; blocked issues
  unblocked in < 24 h.
- **Friday**: converge pass (`/speckit.converge`), demo, milestone checklist
  review, ADR updates.

## Definition of "Milestone Done"

- [ ] All epic checklist items closed (or explicitly deferred with issue)
- [ ] E2E green on staging for the milestone's exit scenario
- [ ] No open `security` or `blocked` issues
- [ ] Specs/ADRs updated; docs current; changelog entries present
