# ADR-0010: Infrastructure — AWS ECS Fargate + Terraform

- **Status**: accepted
- **Date**: 2026-08-14

## Context

We need multi-AZ production, zero-downtime deploys, autoscaling, and a
staging environment — operated by DevOps agents, with the local
`docker compose` topology mirroring production.

## Decision

- **AWS, eu-west-1**: CloudFront + WAF at the edge, ALB, **ECS Fargate**
  for `api`, `workers`, `web`, `dashboard`, `admin`; **Aurora PostgreSQL**
  (multi-AZ), **ElastiCache Redis**, S3 media, Secrets Manager.
- **Terraform** modules under `infra/` (envs: staging/prod); GitHub
  Actions deploys via OIDC (no long-lived cloud keys in CI).
- Blue/green ECS deployments; DB migrations expand/contract (ops.md §3).
- Local: `docker compose` (same images, same env names).

## Consequences

- No cluster management (Fargate) — right size for this stage; EKS is a
  documented future path if scheduling needs grow.
- IaC means staging/prod drift is visible and reviewable.
- AWS cost is bounded by autoscaling limits + staging schedule (ops.md §7).

## Alternatives

- Kubernetes/EKS now: rejected (ops burden, overkill at this stage).
- PaaS (Render/Railway/Fly): viable for launch, but AWS chosen for
  long-run cost and control; Terraform keeps the door open either way.
