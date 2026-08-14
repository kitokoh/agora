# ADR-0002: Modular Monolith Backend (Extraction-Ready)

- **Status**: accepted
- **Date**: 2026-08-14

## Context

A marketplace has 11 natural bounded contexts (identity, catalog, orders,
payments, finance, …). Naive microservices for a small team (even an AI
team) multiply operational burden: deployment, tracing, data consistency,
and schema management. Yet the money path demands strict integrity and the
product may need to scale context-by-context later.

## Decision

One deployable (`services/api`), **modular monolith**: each bounded context
is a module owning its tables (schema-per-module), its facade, and its
events. Modules communicate synchronously through facades and asynchronously
through the outbox/queue. Extraction into standalone services is a
mechanical step (facade → HTTP), documented in architecture.md §10.

## Consequences

- Single deployable: simpler CI, rollouts, debugging; agents can work on
  modules in parallel with clear ownership.
- Strong module discipline is enforced in review (no cross-schema reads).
- Extraction triggers defined (team cadence, load, regulation) — not
  speculative.

## Alternatives

- Full microservices now: rejected (ops overhead, premature).
- Single flat codebase: rejected (would decay into a big ball of mud).
