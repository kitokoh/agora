# Implementation Plan: Identity & Seller Onboarding

**Feature**: 001-identity-onboarding | **Milestone**: M1
**Status**: Approved | **Dependencies**: M0 foundation (repo skeleton, API
bootstrap, `packages/db`, `packages/contracts`, notification module
scaffold)

---

## Tech approach

- Module `identity` inside `services/api` (Fastify), schema `identity`,
  Prisma models (ADR-0003), guard plugin `requirePerm` (ADR-0007).
- Tokens: `@node-rs/argon2`, `jose` (RS256), refresh hashing via sha256;
  session families in `sessions`.
- MFA: `otplib` TOTP + QR provisioning (otpauth://), recovery codes hashed.
- Social: `openid-client` (OIDC discovery) for Google/Facebook/Apple.
- Notifications: reuse `notification` module templates (M0 scaffold).
- Frontend `apps/web` (auth pages) + `apps/dashboard` (onboarding wizard);
  typed SDK from `packages/contracts`.

## File map (targets)

```
services/api/src/modules/identity/
  identity.module.ts        # facade: register, login, verify, reset, mfa, social
  authn.plugin.ts           # bearer verify, attaches actor
  authz.plugin.ts           # requirePerm(...)
  sessions.service.ts
  mfa.service.ts
  social.service.ts
  password.service.ts
  recovery.service.ts
  rate-limit.plugin.ts      # Redis token buckets
  routes/
    auth.routes.ts          # /v1/auth/register|verify|login|refresh|logout|reset|mfa|oauth/*
    onboarding.routes.ts    # /v1/onboarding/* (profile, shop, kyc)
  identity.schema.prisma
packages/contracts/src/identity/   # zod schemas per endpoint
apps/web/app/(auth)/…              # login/register/verify/reset pages
apps/dashboard/app/onboarding/…    # wizard
packages/ui/src/components/form/…  # form primitives used by both
```

## Steps (ordered)

1. Identity schema + migration (users, sessions, roles, permissions,
   audit) + seed roles/permissions.
2. Password service (Argon2id) + register + verification email/token.
3. Session service (RS256 jose, refresh rotation, families, revocation)
   + login/logout/refresh routes + rate limiting.
4. Password reset flow.
5. MFA service (TOTP, recovery codes, enforcement policy) + routes.
6. Social OIDC login + account linking.
7. RBAC: roles/permissions seed, `requirePerm` guard, shop-scoped
   assignments, audit events on all auth actions.
8. Onboarding: profile → shop (`draft`) → KYC draft → approval flow
   (admin endpoint) → `active`; suspension flow.
9. Notification templates (verify, welcome, login alert, suspension).
10. Contract tests per endpoint + unit tests (password, sessions, mfa).
11. E2E Playwright: full onboarding journey; login anomaly alert.
12. Docs: update data-model + ADR-0007 notes if anything changed.

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Crypto bugs (session/MFA) | jose/otplib battle-tested libs; security review of `authn|mfa|sessions` files; unit tests for rotation edge cases |
| Social provider flow variation | OIDC discovery + provider fixture tests |
| Migration collisions with catalog work | M1: only `identity` + `marketplace.shops` schemas touched by this feature |
| Token leakage in logs | log sanitizer test; no tokens in pino fields |
