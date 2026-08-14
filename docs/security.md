# Agora — Security Architecture

**Owner**: security | **Status**: Ratified | **Baseline**: OWASP ASVS L2, GDPR, PCI SAQ-A

---

## 1. Threat Model (STRIDE summary)

| Threat | Mitigation |
| --- | --- |
| **Spoofing** — account takeover | Argon2id passwords, MFA (TOTP) for seller/admin, refresh-token rotation + family revocation, device management, login rate limiting, suspicious-login alerts |
| **Tampering** — order/price manipulation | Signed price snapshots at cart→checkout, immutable order lines, HMAC webhooks (in/out), signature verification on every webhook |
| **Repudiation** — chargebacks/disputes | Append-only audit log, order status history, evidence collection on disputes |
| **Information disclosure** — PII leaks | Field-level encryption for PII at rest, mask in logs, least-privilege DB roles per module, no secrets in code |
| **DoS** | WAF + rate limits at edge, per-token limits, autoscaling, Redis-backed throttling, queue depth alerts |
| **Elevation of privilege** | RBAC matrix with scoped permissions, endpoint-level permission declarations, admin actions audited, separation: buyer/seller/staff/admin |

## 2. Authentication

- **Passwords**: Argon2id (m=64 MiB, t=3, p=4) — never plaintext, never MD5/SHA.
- **Tokens**: RS256 JWT, key rotation (2-key overlap), `kid` header; access 15 min, refresh 30 d with rotation; refresh tokens stored hashed (SHA-256) server-side; device revocation kills the whole session family.
- **MFA**: TOTP (RFC 6238); enforced for sellers and staff; recovery codes (hashed).
- **Social login**: OAuth2/OIDC (Google, Facebook, Apple) — account linking with verified email.
- **Session hardening**: HttpOnly + Secure + SameSite=Strict cookies for web; bearer in Authorization for API clients; CSRF tokens for cookie-authed mutations; login anomaly detection (new device/geo).

## 3. Authorization (RBAC)

- Roles: `buyer`, `seller`, `staff`, `admin`; seller roles scoped **per shop**.
- Permissions are fine-grained keys (`catalog:write`, `orders:read`,
  `payouts:approve`, `moderation:review`, …). Every endpoint declares its
  required permission in code (Fastify plugin) and in OpenAPI.
- Admin consoles cannot be accessed with buyer tokens; privileged actions
  require step-up (re-auth + MFA).

## 4. Payments & PCI

- PCI scope = **SAQ-A** (redirect / Stripe-hosted fields only). Card data
  never transits our servers.
- Stripe webhooks verified by signature + replay protection (timestamp ±5
  min, webhook secret rotation).
- Idempotency keys on every money mutation; provider adapters normalize
  webhooks into `payment_intents` state machine; ledger only moves money on
  verified provider state (ADR-0006).
- Payout approvals: amount thresholds + dual control for manual overrides.

## 5. Data Protection (GDPR)

- PII inventory + lawful-basis register; retention schedules (audit 400 d,
  carts 30 d, deleted shops 1 y then anonymization).
- Right to erasure: anonymize user row (keep ledger/order references
  integrity), export API for data portability.
- Encryption at rest: Aurora (KMS), EBS, S3 (SSE-KMS); TLS 1.2+ everywhere.
- Logs: no PII, no tokens; request-id only.

## 6. Secrets Management

- AWS Secrets Manager; rotation lambdas for Stripe keys + webhook secrets.
- CI never sees production secrets (OIDC + environment-scoped).
- `.env.example` documents names only. `git secrets` / pre-commit scan +
  GitHub secret scanning on the repo.

## 7. Application Hardening

- Security headers (CSP, HSTS, X-Frame-Options, nosniff) at edge.
- Input validation: Zod on every boundary; OpenAPI as contract.
- SSRF guards on outbound fetch allowlist (webhooks: no internal IPs,
  resolve-then-pin).
- Dependency hygiene: `pnpm audit` in CI, Dependabot, CodeQL, nightly
  dependency review; lockfile review on PRs touching `package.json`.
- Rate limiting: edge (WAF) + Redis token buckets per user/IP/route.

## 8. Secure Development

- Security review required for: auth changes, money paths, webhook
  handlers, anything reading PII. Label `security` + assign
  `agent:security`.
- Secrets never in code — a secret in a commit is a security incident, not a
  "fix the typo".
- ASVS L2 checklist as PR gate for the flows above; pentest checklist in
  M6 (see roadmap).

## 9. Incident Response

- Severity table, on-call rotation, runbook index in
  [operations.md](operations.md), blast-radius controls (DB roles, IAM
  scopes), communication templates (status page), postmortem template.

**Related**: ADR-0007 (auth), ADR-0006 (payments/ledger), ADR-0011 (API).
