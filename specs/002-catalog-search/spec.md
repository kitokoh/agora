# Feature Specification: Catalog & Search *(Draft)*

**Feature Branch**: `feat/002-catalog-search`
**Created**: 2026-08-14
**Status**: Draft (to be refined at M2 kickoff)
**Milestone**: M2

---

## Summary

Sellers manage products, variants, inventory, categories and media; buyers
browse, search (Meilisearch), and land on storefront/product pages.

## User Stories (priorities P1 → P3)

1. **(P1) Publish & manage products** — seller creates products with
   variants/SKUs/prices/stock, drafts and publishes; published items appear
   on the storefront.
2. **(P1) Media upload** — seller uploads images/videos via presigned URLs;
   processing pipeline produces thumbnails/WebP; moderation hook.
3. **(P1) Search & browse** — buyer searches with typo tolerance and facets
   (category, price, shop, rating); results in < 150 ms; storefront pages
   SEO-friendly (SSG/ISR).
4. **(P2) Inventory operations** — reservations at checkout, low-stock
   alerts, restock, movements audit trail.
5. **(P3) Bulk import** — CSV import for large catalogs with validation
   report.

## Key decisions already made

- Meilisearch read model via outbox events (ADR-0004, ADR-0005); reindex
  recovery job from Postgres.
- Media pipeline per ADR-0008 (S3 presigned + sharp + CDN + moderation).
- Categories: single-parent tree, attributes schema per category.

## Open questions for M2 kickoff

- Facet defaults and ranking rules (price vs relevance weights)?
- Video support in v1 (encoded sizes, poster frames)?
- Multi-language product content (i18n) — v1 single language?

*This spec is intentionally a stub: `/speckit.specify` at M2 kickoff turns
it into a full spec following 001's depth.*
