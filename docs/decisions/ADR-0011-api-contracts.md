# ADR-0011: API — REST /v1 + OpenAPI from Zod Contracts + Idempotency

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Multiple frontends, the public seller API, webhooks, and future SDKs must
share one contract. Schema drift between backend and consumers is the #1
multi-agent failure mode.

## Decision

- REST over HTTPS, versioned `/v1/*`; RFC 7807 errors; cursor pagination.
- **`packages/contracts` is the single source of truth**: Zod schemas per
  endpoint → auto-generated **OpenAPI 3.1** (json-schema) → typed clients
  for `web/dashboard/admin` + published for the public API.
- **Idempotency-Key** header mandatory on mutating money endpoints (and
  recommended on all POSTs): stored 24 h, replay returns the original
  result, conflict → 409.
- Auth: Bearer JWT for users; OAuth2 client-credentials for third parties.
- Rate limits at edge + per-token buckets (Redis).

## Consequences

- Contract changes are typed and reviewable in one PR; consumers get
  breaking-change warnings via typecheck.
- Money endpoints are safe under client retries (critical for mobile
  networks and webhooks).
- Cost: contract-first discipline slows "quick endpoint" hacks — intended.

## Alternatives

- tRPC/GraphQL: rejected — public API + webhooks favor REST/OpenAPI;
  tRPC could be layered later for internal BFF if wanted.
