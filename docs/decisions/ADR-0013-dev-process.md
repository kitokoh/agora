# ADR-0013: Development Process — Spec-Driven, Trunk-Based, Gated PRs

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Multiple AI agents share one repo. Without a process, parallel agents
collide (migrations, contracts), produce untested code, and drift from the
architecture. We adopt the GitHub **Spec Kit** (spec-driven development) as
the organizing method.

## Decision

- Every feature: **spec → plan → tasks → issues** (Spec Kit loop,
  commands in `.claude/commands/speckit-*.md`; artifacts in `specs/`).
- **Trunk-based**: short-lived branches, PRs, `main` always green.
- **PR gates**: lint, typecheck, unit+integration tests (coverage ≥ 80% on
  new code), contract tests, build, security scans (CodeQL, audit, secret
  scan), one approving review, conventional commits, Changesets.
- Constitution in `AGENTS.md` (roles, DoD, security rules); agent
  operations in `docs/agent-operations.md`.

## Consequences

- Parallel agents have clear lanes; collisions are handled by ownership
  rules (agent-operations.md §2).
- Velocity cost: process overhead per change — accepted as the price of
  industrial quality ("no half measures").

## Alternatives

- Unstructured prompt-driven development: rejected (this is exactly what
  the user forbade).
