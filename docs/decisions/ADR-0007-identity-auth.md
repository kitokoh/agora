# ADR-0007: Identity — Custom Module (Argon2id, RS256, Refresh Rotation)

- **Status**: accepted
- **Date**: 2026-08-14

## Context

We need buyer/seller/staff/admin identities with MFA, device management,
social login, and fine-grained RBAC — tightly coupled to marketplace
semantics (shop-scoped roles), audit, and GDPR flows. Managed IdPs (Auth0)
add per-seat cost and integration friction; self-hosted Keycloak is heavy
for agents to operate.

## Decision

Custom **identity module** inside the monolith:

- Passwords: **Argon2id** (never bcrypt for new code).
- Access tokens: **RS256 JWT** (15 min), signing-key rotation with `kid`;
  refresh tokens (30 d) stored hashed, **rotation on use**, family
  revocation for device logout.
- **MFA**: TOTP, enforced for sellers/staff/admin; recovery codes hashed.
- **Social login**: OIDC/OAuth (Google, Facebook, Apple) with verified-email
  account linking.
- **RBAC**: roles + permission keys, shop-scoped assignments, endpoint
  guards; all auth events in the audit log.
- Rate limiting + anomaly detection (new device/geo) per user.

## Consequences

- Full control of security semantics and GDPR; no per-seat cost.
- We own the crypto-critical code: mitigation = strict review by
  `agent:security` + ASVS L2 checklist + external pentest before launch
  (M6).
- Migration path to an IdP exists (OIDC) if operational burden grows.

## Alternatives

- Auth0/Firebase Auth: rejected (cost, vendor lock, less control).
- Keycloak self-hosted: rejected (ops weight for current stage).
