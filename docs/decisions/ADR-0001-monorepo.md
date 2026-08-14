# ADR-0001: Monorepo with Turborepo + pnpm

- **Status**: accepted
- **Date**: 2026-08-14
- **Deciders**: architect, user

## Context

Multiple apps (web, seller dashboard, admin console) and shared packages
(design system, contracts, SDK, DB layer, config) must evolve together under
multi-agent development. Separate repos create contract drift and slow
cross-cutting changes (schema, API contracts).

## Decision

Single monorepo managed by **pnpm workspaces** + **Turborepo** task
orchestration, TypeScript strict everywhere. Layout: `apps/*` (deployables),
`packages/*` (shared libraries), `services/*` (backend deployables).

## Consequences

- One `pnpm install`, one lockfile, atomic cross-package changes.
- Turbo caches builds/tests; CI stays < 10 min.
- Contract changes are visible in the same PR as consumers.
- Cost: monorepo tooling discipline required; git history is shared; large
  clone for contributors.

## Alternatives

- Microservice-per-repo: rejected (contract drift, slower agents).
- Nx: viable, but Turborepo is lighter for our shape.
