# Architecture Decision Records

Each ADR documents a decision, its context, and its consequences. Statuses:
`proposed` → `accepted` → `superseded`.

| ADR | Decision | Status |
| --- | --- | --- |
| [ADR-0001](ADR-0001-monorepo.md) | Monorepo with Turborepo + pnpm | accepted |
| [ADR-0002](ADR-0002-modular-monolith.md) | Modular monolith backend, extraction-ready | accepted |
| [ADR-0003](ADR-0003-postgres-prisma-outbox.md) | PostgreSQL + Prisma + outbox | accepted |
| [ADR-0004](ADR-0004-meilisearch.md) | Meilisearch for product search | accepted |
| [ADR-0005](ADR-0005-events-queue.md) | Event-driven via outbox → BullMQ/Redis | accepted |
| [ADR-0006](ADR-0006-payments-stripe-ledger.md) | Stripe + Connect split payouts + double-entry ledger | accepted |
| [ADR-0007](ADR-0007-identity-auth.md) | Custom identity module (Argon2id, RS256, refresh rotation) | accepted |
| [ADR-0008](ADR-0008-media-pipeline.md) | S3 + sharp + CDN media pipeline | accepted |
| [ADR-0009](ADR-0009-observability.md) | OpenTelemetry + Grafana LGTM + Sentry | accepted |
| [ADR-0010](ADR-0010-aws-infra.md) | AWS ECS Fargate + Terraform; compose mirrors prod | accepted |
| [ADR-0011](ADR-0011-api-contracts.md) | REST /v1 + OpenAPI/Zod contracts, idempotency | accepted |
| [ADR-0012](ADR-0012-frontend.md) | Next.js 15 App Router + Radix/Tailwind design system | accepted |
| [ADR-0013](ADR-0013-dev-process.md) | Spec-driven dev, trunk-based, PR gates, changesets | accepted |

**Process**: propose an ADR via the `adr` issue template; merge changes
architecture-wide only with `agent:architect` review.
