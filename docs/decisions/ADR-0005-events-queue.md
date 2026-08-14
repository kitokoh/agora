# ADR-0005: Events & Queues — Outbox → BullMQ (Redis)

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Async work (indexing, emails, payouts, webhooks, media processing) must be
durable, retried with backoff, observable, and idempotent — without a
second data store for events.

## Decision

- **Redis + BullMQ** for queues/jobs; Redis also serves cache + rate-limit
  counters + idempotency keys.
- Producers write events to the outbox (same txn, ADR-0003); a relay worker
  publishes to BullMQ topics (`catalog.*`, `orders.*`, `payments.*`, …).
- Consumers: idempotent (dedupe by event id), retry with exponential
  backoff + dead-letter queue + alerting; every job traced (ADR-0009).
- Event contract: `{id, type, occurredAt, aggregateId, version, payload}`
  — types owned by `packages/contracts`.

## Consequences

- Exactly-once-effect semantics (at-least-once + idempotency).
- Single cache/queue tier — simple ops.
- Redis is not a durable message broker: acceptable because the outbox is
  the durable source; on Redis loss, replay from outbox (documented).

## Alternatives

- SQS/SNS or Kafka: revisit when volume/ordering requirements grow; the
  outbox abstraction keeps the door open.
