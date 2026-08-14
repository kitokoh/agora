# ADR-0003: PostgreSQL + Prisma + Transactional Outbox

- **Status**: accepted
- **Date**: 2026-08-14

## Context

All business state lives in one relational store; money integrity requires
ACID. Async side effects (search indexing, emails, webhooks) must not
diverge from the transaction that caused them.

## Decision

- **PostgreSQL 16** (Aurora in prod), one logical database,
  schema-per-module, `uuidv7` IDs.
- **Prisma** as ORM/schema source of truth; migrations versioned in the
  same PR as schema changes.
- **Transactional outbox**: every module writes its domain events into an
  `outbox` table in the same DB transaction; a relay worker publishes them
  to the queue. At-least-once delivery with idempotent consumers.

## Consequences

- Strong consistency for business state; eventual consistency for
  projections, bounded (SLO ≤ 5 s search lag).
- Prisma gives fast agent onboarding and safe migrations.
- Cost: outbox relay adds a moving part; consumers must be idempotent
  (mandatory pattern).

## Alternatives

- Event sourcing / CDC (Debezium): heavier; revisit at extraction time.
