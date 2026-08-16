# Agora — Observability

**Owner**: devops | **Stack**: OpenTelemetry → Grafana LGTM (Loki, Grafana, Tempo, Mimir) + Sentry

---

## 1. Pillars

| Pillar | Tool | What |
| --- | --- | --- |
| Logs | pino (JSON) → Loki | structured, request-id correlated, PII-free |
| Traces | OTel SDK → Tempo | 100% of HTTP + queue jobs, sampling 10% for long tails |
| Metrics | Prometheus format → Mimir | RED/USE per service, business metrics |
| Errors | Sentry | stack traces, releases, alerting, breadcrumbs |
| Synthetic | Playwright + healthchecks | checkout journey every 5 min on staging, 15 min on prod |

## 2. Conventions

- Every request carries `X-Request-Id` (edge-generated), propagated to logs
  and traces. Responses echo it for support.
- Log levels: `fatal|error|warn|info|debug`. Business events logged at
  `info` with structured fields — never string-concatenated.
- Every external call (Stripe, Meilisearch, S3, email) is a span with
  `peer.service` and `http.*` attributes; queue jobs get job-id spans.
- Health: `/healthz` (liveness, no deps) and `/readyz` (DB, Redis,
  Meilisearch, S3 ping). Both used by ALB/ECS and by `docker compose`.

## 3. Local LGTM stack (development)

```bash
docker compose --profile observability up -d   # prometheus, loki, tempo, grafana
```

- Grafana: http://localhost:3000 (anonymous admin)
- OTLP endpoint for services: `http://localhost:4318` (Tempo)
- Provisioning + dashboards live in `ops/observability/`
  (`prometheus.yml`, `tempo.yml`, `grafana-provisioning/`, `dashboards/`)
- Services export when `NODE_ENV=staging|production` (or
  `exportOnlyInProduction=false`); locally use `OTEL_EXPORTER_OTLP_ENDPOINT`.

## 4. Dashboards (Grafana)

1. **Commerce** — checkout success rate, order p95/p99, payment webhook
   lag, ledger balance drift check.
2. **API health** — error rates by module, latency histograms, queue depth.
3. **Search** — indexing lag, query p95, zero-result rate.
4. **Infra** — ECS CPU/mem, RDS/Redis metrics, autoscaling events.
5. **Business** — GMV, orders/day, sellers, payouts, commission revenue.

## 5. SLOs & Alerting

| SLO | Target | Burn alert |
| --- | --- | --- |
| Checkout success (web→paid) | ≥ 99.5% / 30 d | 2% error budget consumed in 1 h |
| Order API latency p95 | ≤ 800 ms | 1 h rolling |
| Search latency p95 | ≤ 150 ms | 1 h rolling |
| Queue lag p95 | ≤ 60 s | 15 min rolling |
| Availability | ≥ 99.9% | 5 min |

Alerts: Grafana → PagerDuty/email; severity routing (critical/ warning);
runbooks linked (see [operations.md](operations.md)).

## 5. Instrumentation checklist (per service/app)

- [ ] pino logger with request-id
- [ ] OTel: HTTP server/client, DB, Redis, BullMQ, Stripe calls
- [ ] `/healthz` + `/readyz`
- [ ] Sentry init with release name
- [ ] Business metric: orders, payments, payouts (counter/histogram)
- [ ] Logs sanitized (no PII, no tokens, no card data)

## 6. Log retention

- Loki: 30 d hot, 90 d cold (S3). Tempo: 7 d. Mimir: 13 months (SLOs).
- Audit events (DB): 400 d (see data-model).
