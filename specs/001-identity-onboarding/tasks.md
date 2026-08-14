# Tasks: Identity & Seller Onboarding

**Feature**: 001-identity-onboarding | **Milestone**: M1
**Generated**: 2026-08-14 (Spec Kit) | **Status**: Ready for
`/speckit.taskstoissues`

Each task is independently implementable and testable. Order = execution
order (1 before 2, etc.); dependencies noted inline.

---

## 1. Identity schema & migration

**DoD**: Prisma models for `users`, `sessions`, `roles`,
`role_assignments`, `permissions`, `audit_events` in schema `identity`;
migration applied; seed script for default roles/permissions.

## 2. Password + registration

**DoD**: Argon2id hash/verify; `POST /v1/auth/register` creates
`unverified` user, issues single-use verification token, sends email
(via notification module); rate limited; duplicate email → 409 with
reset link hint.

## 3. Email verification

**DoD**: `POST /v1/auth/verify` (token single-use, expiry 24 h, re-issue
endpoint rate-limited); account becomes `verified`.

## 4. Session service & login

**DoD**: RS256 access (15 min) + hashed refresh (30 d) with rotation and
session families; `POST /v1/auth/login`, `POST /v1/auth/refresh`
(rotation + family revocation on reuse), `POST /v1/auth/logout`;
HttpOnly cookie option for web, Bearer for API clients.

## 5. Rate limiting & lockout

**DoD**: Redis token buckets on login/register/reset/MFA; 10-failure
lockout (15 min); `login-anomaly` audit events; tests prove lockout.

## 6. Password reset

**DoD**: `POST /v1/auth/reset/request` (rate-limited, no account
enumeration) + `POST /v1/auth/reset/confirm` (single-use token, policy
validation).

## 7. MFA (TOTP)

**DoD**: enable (current password + OTP), verify, disable (password +
OTP), recovery codes (10, hashed, single-use); enforcement for
seller/staff roles at login; QR provisioning page.

## 8. Social login (OIDC)

**DoD**: Google/Facebook/Apple OIDC discovery + callback; verified-email
account linking; fixtures tests per provider.

## 9. RBAC & guards

**DoD**: `requirePerm(...)` Fastify plugin; permission matrix seeded;
shop-scoped seller role assignments; all auth/admin actions write audit
events; deny-by-default tests.

## 10. Seller onboarding

**DoD**: profile step, shop creation (`draft`, slug validation), KYC
draft; admin approval endpoint → `active`; suspension/reinstatement;
resumable wizard state persisted.

## 11. Notification templates

**DoD**: verification, welcome, login alert, suspension, MFA setup —
templates versioned in `notification` module; sending idempotent.

## 12. Contract & unit tests

**DoD**: OpenAPI contract tests for every new endpoint; unit tests for
password, sessions (rotation/reuse), MFA; coverage ≥ 80% new code.

## 13. E2E onboarding journey

**DoD**: Playwright: register → verify → login → MFA setup → shop → KYC →
active; login-anomaly alert test; runs green in CI.

## 14. Docs & security review

**DoD**: `data-model.md` updated; ADR-0007 notes current; `agent:security`
review sign-off on authn/authz/mfa/session files; ASVS L2 auth checklist
ticked.

---

## Out of scope (next milestones)

- Catalog + shop storefront (M2), payments (M3), plan billing (M4).
- Admin user management UI beyond approval/suspension (M5).
