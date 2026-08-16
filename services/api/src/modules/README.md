# API modules (bounded contexts)

The API is a **modular monolith**: one deployable, eleven bounded contexts
(see `docs/architecture.md` §3.2). Each directory below is a future module:

| Directory | Module | Milestone |
| --- | --- | --- |
| `identity/` | users, credentials, sessions, MFA, RBAC, audit | M1 |
| `marketplace/` | shops, seller plans, commissions, reviews, KYC | M1 (onboarding subset) |
| `catalog/` | products, variants, SKUs, categories, attributes | M2 |
| `search-indexer/` | Meilisearch read-side projection | M2 |
| `cart/` | carts, cart items, price snapshots | M3 |
| `orders/` | orders, state machine, refunds | M3 |
| `payments/` | Stripe adapters, webhooks, idempotency | M3 |
| `finance/` | double-entry ledger, escrow, payouts | M3 |
| `fulfillment/` | shipping methods, labels, tracking | M4 |
| `notifications/` | templates, email/SMS/in-app outbound | M1 (scaffold) |
| `admin/` | moderation, disputes, KYC review, audit queries | M5 |

**Contract**: a module is an `AgoraModule` (`modules/index.ts`) exposing
`{ name, register(app) }`. Modules are mounted in dependency order by
`registerModules`; never read another module's tables directly
(AGENTS.md §7 — outbox → BullMQ for async).

Until a module is implemented, its directory intentionally stays empty
(kept in git via `.gitkeep`).
