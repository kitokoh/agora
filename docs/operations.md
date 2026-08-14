# Agora — Operations

**Owner**: devops | Environments: `local` · `staging` · `production`

---

## 1. Environments

| Env | Purpose | Data | Access |
| --- | --- | --- | --- |
| **local** | dev, agents run everything here | synthetic | `docker compose up -d` |
| **staging** | integration, E2E, load tests | anonymized seed | GitHub Actions deploys every merge to `main` |
| **production** | real traffic | real | protected: manual approve + release tag |

## 2. CI/CD (GitHub Actions)

- **CI** (every PR): lint → typecheck → test → contract tests → build →
  coverage report → security (CodeQL, `pnpm audit`, secret scan). Gate: all
  green, coverage ≥ 80% on changed code.
- **Deploy staging**: merge to `main` → build images → ECS update (blue/
  green) → synthetic smoke (checkout journey).
- **Deploy prod**: release tag (`vX.Y.Z`, changesets) → staging E2E re-run →
  manual approve → blue/green → DB migration (expand/contract) → smoke →
  release notes.
- **Release train**: semantic-release-style changelog via Changesets;
  conventional commits enforced.

## 3. Database Migrations

- Prisma migrations, expand/contract:
  1. Expand: add nullable columns/tables; deploy API version that tolerates
     both.
  2. Migrate: backfill in batches (worker job).
  3. Contract: remove old columns in a later release.
- Long-running migrations never run inside a transaction that blocks writes.
- Every migration reversible unless explicitly documented.

## 4. Backup & Recovery

- Aurora: PITR (35 d), daily snapshots (30 d), cross-region copy weekly.
- Redis: AOF + daily snapshot; rebuild acceptable (cache only).
- S3 media: versioning + lifecycle; Meilisearch: reindex-from-source
  (source of truth is Postgres + media).
- **DR**: RTO 4 h / RPO 15 min; runbook: `infra/runbooks/dr.md`; restore
  drill quarterly (staging).

## 5. Runbooks (index)

| Runbook | Trigger |
| --- | --- |
| `checkout-down` | checkout success rate SLO burn |
| `payment-webhook-lag` | webhook queue depth > threshold |
| `ledger-drift` | balance reconciliation mismatch |
| `search-index-lag` | indexer consumer lag > 5 min |
| `db-connection-exhaustion` | RDS max connections alerts |
| `secrets-rotation` | Stripe/DB key rotation |
| `incident-response` | SEV-1/2 process, comms, postmortem |

## 6. On-call & Support

- On-call rotation (staging during build; prod after launch), alert routing
  per severity, status page, postmortem template in `docs/postmortem.md`.
- Support mailboxes mapped to issue labels (`support:buyer`,
  `support:seller`).

## 7. Cost guardrails

- Autoscaling limits per service; RDS instance class capped; staging shut
  down nights/weekends (schedule); budget alerts at 80%/100%.
