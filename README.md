# Agora 🛒

**Industrial-grade marketplace SaaS** for boutiques and independent sellers —
the storefront, payments, and seller-ops platform for people who want to sell
their products online, built to the same product and engineering bar as
Spotify or Amazon.

- **Multi-vendor**: any boutique or individual can open a shop, publish
  products, sell, and get paid.
- **Platform economics**: commissions, escrow, split payouts, seller
  subscription tiers (Free / Plus / Pro).
- **Trust layer**: reviews, disputes, KYC, moderation, double-entry ledger.
- **Spec-driven, multi-agent**: the roadmap is executed by several AI dev
  agents coordinated through GitHub Issues/Projects and the
  [Spec Kit](https://github.com/github/spec-kit) workflow.

> Status: **Foundation (M0)** — architecture ratified, backlog provisioned,
> implementation starting.

---

## Repository map

```
apps/          Customer-facing applications (Next.js 15)
  web/         Buyer marketplace + storefronts (SPA, SSR)
  dashboard/   Seller back-office
  admin/       Platform admin back-office
packages/      Shared libraries (design system, contracts, config, db, sdk)
services/      Backend services (Node.js + Fastify)
docs/          Architecture, security, ops, ADRs (decision records)
specs/         Spec Kit artifacts: spec / plan / tasks per feature
.github/       Issue templates, CI/CD workflows, agent plumbing
```

## Quickstart (local)

```bash
cp .env.example .env            # fill in secrets (local defaults work)
docker compose up -d            # postgres, redis, minio, meilisearch
pnpm install
pnpm db:generate && pnpm db:migrate
pnpm dev                        # turbo dev: API + web + dashboard
```

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | System architecture (C4), modules, data flows |
| [docs/data-model.md](docs/data-model.md) | Core entities and relationships |
| [docs/security.md](docs/security.md) | Threat model, auth, secrets, PCI scope |
| [docs/observability.md](docs/observability.md) | Logs, traces, metrics, SLOs |
| [docs/operations.md](docs/operations.md) | Environments, releases, runbooks |
| [docs/roadmap.md](docs/roadmap.md) | Milestones M0→M6 and phasing |
| [docs/agent-operations.md](docs/agent-operations.md) | **How AI agents work on this repo** |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records (ADRs) |

## How work happens here

1. Every feature starts as a **spec** (`specs/<id>-<name>/spec.md`).
2. Specs are refined into **plans** and **task lists** (Spec Kit workflow).
3. Task lists become **GitHub issues** tracked on the
   **Agora — Delivery** project board.
4. Dev agents pick issues, implement on short-lived branches, and open PRs
   that must pass CI + review (see [AGENTS.md](AGENTS.md)).

Read [AGENTS.md](AGENTS.md) — it is the operating contract for every agent
(or human) touching this repository.
