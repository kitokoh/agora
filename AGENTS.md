# Agora Constitution — Operating Contract for AI Agents

> This file governs every agent (and human) working in this repository.
> Read it fully before doing anything. It supersedes ad-hoc instructions.
> Amendments require an issue + ADR.

## 0. Mission

Agora is an **industrial-grade marketplace SaaS**: boutiques and individuals
open shops, list products, sell, and get paid — platform-grade quality,
Spotify/Amazon engineering bar. We favor **rigor over velocity**, **boring
technology**, and **explicit design** (spec-driven development). No half
measures: if it ships, it ships tested, observable, documented, and secure.

## 1. Repo map

```
apps/web          Buyer marketplace + storefronts        (Next.js 15, App Router)
apps/dashboard    Seller back-office                     (Next.js 15)
apps/admin        Platform admin back-office             (Next.js 15)
services/api      Backend API — modular monolith         (Node 20, Fastify)
packages/ui       Design system (Radix + Tailwind, Storybook)
packages/contracts  API contracts (OpenAPI/Zod, source of truth)
packages/db       Prisma schema + migrations (shared)
packages/sdk      TypeScript client SDK
packages/config   Shared eslint/ts/prettier/tailwind presets
packages/queue    BullMQ workers + jobs
packages/observability  OpenTelemetry bootstrap
docs/             Architecture, security, ops, ADRs
specs/            Spec Kit artifacts (spec → plan → tasks)
.github/          Templates, CI/CD, agent plumbing
```

## 2. The Spec-Driven Loop (NON-NEGOTIABLE)

No feature is implemented straight from a chat prompt. Every feature follows
the Spec Kit pipeline, in order:

1. **Specify** — `/speckit.specify` (or `specs/<id>-<name>/spec.md`):
   user stories with priorities (P1 > P2 > P3), acceptance scenarios
   (Given/When/Then), functional requirements (FR-xxx), success criteria
   (SC-xxx), edge cases.
2. **Plan** — `/speckit.plan`: technical approach, files touched, stack
   choices, risks. Architecture must respect the ADRs in `docs/decisions/`.
3. **Tasks** — `/speckit.tasks`: dependency-ordered task list, each task
   independently testable.
4. **Issues** — `/speckit.taskstoissues`: convert tasks to GitHub issues with
   labels, dependencies, and the spec/plan links.
5. **Implement** — pick an issue, branch, code, test, PR.
6. **Converge** — `/speckit.converge` after implementation: assess codebase
   against spec/plan/tasks; append remaining work.

A spec is **Draft → In Review → Approved**. Only Approved specs produce
tasks. Tasks without a linked spec are rejected in review.

## 3. Working Agreement

- **Trunk-based**: `main` is always green and deployable. Short-lived
  branches (`feat/`, `fix/`, `chore/`) merged via PR.
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`,
  `test:`, `docs:`, `perf:`, `security:` + optional scope, e.g.
  `feat(catalog): add variant pricing`.
- **PR rules**: title = issue reference + summary. Body must list what,
  why, how tested. Self-review first. Keep PRs < 400 lines unless justified.
- **Review**: every PR needs at least one approving review (human or agent)
  and green CI (lint, typecheck, unit, contract, build).
- **Definition of Done** (all must hold):
  - [ ] Spec linked and Approved (for features)
  - [ ] Unit tests for new logic; integration tests for boundary/API changes
  - [ ] TypeScript strict passes; lint clean
  - [ ] Observability: structured logs, spans, metrics where relevant
  - [ ] Documentation updated (README/ADRs if behavior changed)
  - [ ] No secrets in code; env vars documented in `.env.example`
  - [ ] Migration included and reversible where possible

## 4. Agent Roles & Labeling

Agents claim issues and set their role via labels. Never work outside your
role without saying so.

| Label | Responsibility |
| --- | --- |
| `agent:architect` | ADRs, cross-cutting design, spec approval, API contracts |
| `agent:backend` | `services/*`, `packages/db`, jobs, integrations |
| `agent:frontend` | `apps/*`, `packages/ui`, Storybook, a11y |
| `agent:devops` | CI/CD, infra (Terraform/Docker), observability plumbing |
| `agent:qa` | Test plans, E2E (Playwright), load tests, acceptance runs |
| `agent:security` | Threat model, auth, secrets, dependency & code scanning |

## 5. Quality Gates (enforced in CI)

1. `pnpm lint` — ESLint (strict preset) + Prettier check
2. `pnpm typecheck` — TypeScript strict, `noUncheckedIndexedAccess`
3. `pnpm test` — Vitest unit + integration; coverage ≥ 80% on new code
4. `pnpm build` — all packages and apps build
5. Contract tests for every public endpoint (`packages/contracts`)
6. Security: CodeQL, dependency review, secret scanning, `pnpm audit`
7. E2E (Playwright) on the critical journeys before merge to release

## 6. Security Rules (absolute)

- **Never** commit secrets, tokens, keys — not even "temporarily".
- Secrets live in AWS Secrets Manager / env only. `.env.example` documents
  names, never values.
- Money flows only through the ledger module. Never mutate balances directly.
- PII: encrypt at rest, mask in logs, respect GDPR deletion flows.
- Auth: Argon2id passwords, RS256 JWT with rotation, refresh-token rotation,
  MFA (TOTP) for sellers/admins. Follow ADR-0007.
- Payment data: PCI scope is outsourced to Stripe (never store PAN).
- Anything suspicious: open a `security` issue immediately, do not "fix
  quietly" alone.

## 7. Data & Migrations

- Single logical PostgreSQL database, **schema per bounded context**
  (`identity`, `catalog`, `orders`, `payments`, `finance`, `marketplace`,
  `notification`, `audit`).
- Prisma is the source of truth for the schema. Every change ships a
  migration in the same PR.
- Cross-module communication: synchronous via module interfaces, async via
  the **outbox → BullMQ** pattern (ADR-0005). Never read another module's
  tables directly.
- All money is integer minor units (cents / centimes). No floats. Ever.

## 8. Observability

- Structured JSON logs (pino) with request-id correlation.
- OpenTelemetry spans on every external call and queue job (ADR-0009).
- Metrics for SLOs: checkout success, order latency p95, queue lag,
  search p95, error rates.
- Every service exposes `/healthz` and `/readyz`.

## 9. Communication

- Use issues for decisions that outlive the hour. Comments record rationale.
- If a task takes you more than ~2 hours of exploration without code, stop
  and open a question/design issue.
- Prefer "small PRs, frequent" over "big bang".

## Governance

The Constitution supersedes all other local practices. Amendments require an
issue proposing the change, an ADR when architectural, and this file updated
in the same PR.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
