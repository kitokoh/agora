# ADR-0009: Observability — OpenTelemetry + Grafana LGTM + Sentry

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Multi-agent development and money flows demand end-to-end visibility:
request correlation, queue-job tracing, SLO burn alerts, and error
triage. Cloud-vendor lock-in (X-Ray/Datadog) should be avoided.

## Decision

- **OpenTelemetry** SDK everywhere (HTTP, DB, Redis, BullMQ, Stripe calls);
  OTLP export.
- **Grafana LGTM**: Loki (logs), Tempo (traces), Mimir (metrics),
  Grafana (dashboards/alerts). Self-hosted on the ECS cluster or Grafana
  Cloud managed (ops decision, same protocol).
- **Sentry** for error tracking in all apps/services, release-tagged.
- SLOs + burn alerts per observability.md §4; runbooks in ops.md.

## Consequences

- One protocol, no vendor lock; dashboards owned by the team.
- Ops cost of running LGTM is real but bounded; staging mirrors prod.
- Every agent's code must include spans/logs per the checklist
  (observability.md §5) — enforced in review.

## Alternatives

- Datadog: great but expensive and proprietary.
- AWS-native (X-Ray + CloudWatch): weaker correlation, lock-in.
