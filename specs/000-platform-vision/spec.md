# Feature Specification: Agora Platform — Vision & Foundations

**Feature Branch**: `main` (M0)
**Created**: 2026-08-14
**Status**: Approved
**Input**: Product brief — "marketplace SaaS pour boutiques et particuliers,
qualité Spotify/Amazon, construite par plusieurs agents IA via GitHub
Spec Kit."

---

## Summary

Agora is a multi-vendor marketplace SaaS. Boutiques and independent sellers
open a shop, publish products with rich media, sell through a buyer-facing
marketplace (with per-shop storefronts), and get paid through a trusted
escrow + payout engine. The platform takes a commission and sells seller
subscription tiers (Free/Plus/Pro). The build is **spec-driven and
multi-agent** (Spec Kit on GitHub), with an industrial engineering bar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Buyer buys from a shop (Priority: P1)

A buyer discovers a product via search, adds it to the cart, checks out
with a card, and receives email confirmation with order status tracking.

**Why this priority**: the core transaction — nothing else matters if this
doesn't work with absolute integrity.

**Independent Test**: can be fully tested by placing a real order in the
staging environment with Stripe test mode and observing ledger entries,
order email, and dashboard order visibility.

**Acceptance Scenarios**:

1. **Given** a published product in an active shop, **When** a logged-in
   buyer searches and adds it to cart, **Then** cart shows correct price
   snapshot and stock is reserved at checkout.
2. **Given** a valid cart, **When** the buyer confirms payment (Stripe
   test), **Then** order transitions `placed → paid`, ledger posts balanced
   entries (buyer/escrow/commission), and confirmation email is sent.
3. **Given** a duplicate `Idempotency-Key` retry, **When** the same request
   is replayed, **Then** the original result is returned and no double
   charge or double entry occurs.

### User Story 2 — Seller opens a shop and sells (Priority: P1)

A seller signs up, verifies email, completes onboarding, creates a shop,
publishes products with images, receives an order, fulfills it, and is paid
via payout.

**Why this priority**: seller supply is the platform's lifeblood.

**Independent Test**: full seller journey in staging: signup → shop → 3
products → test order → fulfill → payout scheduled.

**Acceptance Scenarios**:

1. **Given** a new user, **When** they complete onboarding, **Then** a shop
   is created in `draft` and becomes `active` after KYC draft + admin
   review.
2. **Given** a product with valid media, **When** published, **Then** it is
   searchable within 5 s and visible on the storefront.
3. **Given** a fulfilled order, **When** the settlement schedule fires,
   **Then** the ledger moves escrow → seller payout (minus commission) and
   the payout appears in the seller dashboard.

### User Story 3 — Platform admin governs the marketplace (Priority: P2)

Staff moderate content, review disputes, approve payouts above thresholds,
and see a live audit trail.

**Why this priority**: trust and compliance; needed before public launch.

**Independent Test**: admin console actions on staging with an admin role
token; every action appears in the audit log.

**Acceptance Scenarios**:

1. **Given** a reported product, **When** staff archive it, **Then** it
   disappears from search/storefront and the action is audited.
2. **Given** a dispute, **When** staff resolve it, **Then** the ledger posts
   the corresponding refund/adjustment entries.
3. **Given** an admin token, **When** calling buyer-scoped endpoints,
   **Then** authorization denies (RBAC matrix).

### User Story 4 — Seller subscribes to a plan (Priority: P3)

A seller upgrades from Free to Pro (lower commission, custom domain) via
Stripe subscription billing; downgrade/plan expiry degrades features
gracefully.

**Why this priority**: platform revenue model; can follow launch.

**Independent Test**: plan switch in staging; feature gates verified per
plan.

**Acceptance Scenarios**:

1. **Given** a Free shop, **When** the owner subscribes to Pro, **Then**
   commission rate and feature flags update immediately and billing starts.
2. **Given** an expired subscription, **When** renewal fails, **Then** the
   shop is notified and gates downgrade without data loss.

### Edge Cases

- Out-of-stock at checkout → cart revalidation error with clear message.
- Stripe webhook delayed/duplicated → state machine + idempotency + replay.
- Payment succeeds but webhook lost → reconciliation job (ledger drift
  check) + manual review.
- Seller suspended mid-order → order completes; new orders blocked.
- GDPR erasure request with open orders → anonymize user, keep order
  integrity.
- Concurrent checkout of last unit by two buyers → one succeeds (reserved
  stock), other gets clean failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support three personas (buyer, seller, admin)
  with distinct authenticated experiences.
- **FR-002**: Sellers MUST be able to create shops, products, variants,
  categories, and inventory without support intervention.
- **FR-003**: System MUST provide typo-tolerant search with facets
  (category, price, shop, rating) returning results in < 150 ms p95.
- **FR-004**: System MUST process orders through an explicit state machine
  with immutable order lines and full history.
- **FR-005**: System MUST move money only through a double-entry ledger
  (escrow, commission, payouts) — no direct balance mutations.
- **FR-006**: System MUST verify Stripe webhooks by signature and enforce
  idempotency on all money mutations.
- **FR-007**: System MUST support seller subscription plans (Free/Plus/Pro)
  with feature gating and Stripe billing.
- **FR-008**: System MUST provide admin moderation, dispute resolution,
  payout approval, and audit-log querying.
- **FR-009**: System MUST support GDPR (erasure, export) and retain audit
  events for 400 days.
- **FR-010**: System MUST send transactional notifications (email/SMS/in-
  app) and signed outbound webhooks to seller integrations.
- **FR-011**: All async side effects MUST flow through the outbox → queue
  (at-least-once, idempotent consumers).

### Key Entities

- **User / Session / Role**: identity, authN/authZ (ADR-0007).
- **Shop / Plan / CommissionConfig**: seller tenant + platform economics.
- **Product / Variant / InventoryMovement / Category / MediaAsset**:
  catalog (ADR-0004 for search projection).
- **Cart / Order / OrderLine / OrderStatusEvent**: commerce lifecycle.
- **PaymentIntent / ProviderAccount / LedgerAccount / JournalEntry /
  LedgerEntry / Payout**: money (ADR-0006).
- **Review / Dispute / SellerKyc**: trust layer.
- **Notification / WebhookEndpoint / WebhookDelivery**: outbound comms.
- **AuditEvent**: governance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Full buyer purchase completes in < 60 s on staging.
- **SC-002**: Checkout API p95 ≤ 800 ms; search p95 ≤ 150 ms at 10× launch
  load.
- **SC-003**: 99.9% monthly availability; zero silent money loss (ledger
  reconciles to the cent, automated drift check).
- **SC-004**: Seller onboarding (signup → first published product) < 10
  minutes of user time.
- **SC-005**: Zero `security`-labeled regressions in the last 30 d before
  launch; ASVS L2 checklist passed.

## Assumptions

- Mobile apps out of scope for v1 (responsive web + PWA).
- Market launch in a single currency/market (EUR, EU) with multi-currency
  prepared but not launched.
- Seller identity verification (KYC) is manual-first with provider-assisted
  verification as an option.
- The team is a set of AI agents coordinated on GitHub; humans review
  architecture and money-path changes.
