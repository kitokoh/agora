# ADR-0004: Meilisearch for Product Search

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Marketplace search needs typo tolerance, faceting, fast instant-search
latency, and simple operations that AI agents can run locally. Elastic/Open
Search offer power at a large ops cost; Postgres FTS is weaker for
faceting/typos.

## Decision

**Meilisearch** as the search engine (self-hosted; managed option later).
Read-model index built from catalog events via the outbox. Indexes:
`products` (title/description/attributes/shop), `shops`. Facets: category,
price range, shop, rating, status filters.

## Consequences

- p95 < 150 ms easily; typo tolerance out of the box; simple local
  container in docker-compose.
- Reindex-from-source (Postgres) documented as recovery path.
- Migration path to OpenSearch exists if scale demands (indexer is
  event-driven and swappable behind a port).

## Alternatives

- OpenSearch: rejected for ops cost at this stage; keep as escape hatch.
- Postgres FTS: rejected (facets/typos/ranking weaker).
