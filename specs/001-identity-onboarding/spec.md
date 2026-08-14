# Feature Specification: Identity & Seller Onboarding

**Feature Branch**: `feat/001-identity-onboarding`
**Created**: 2026-08-14
**Status**: Approved
**Input**: M1 milestone — "who is who, and how a seller opens a shop."

---

## Summary

Authentication and authorization for all personas (buyer, seller, staff,
admin), session security, MFA, social login, and the seller onboarding
journey from signup to an active shop.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Register and verify (Priority: P1)

A visitor registers with email+password, receives a verification email,
verifies, and logs in. Password uses Argon2id; brute-force is rate-limited.

**Why this priority**: every other story depends on having an identity.

**Independent Test**: register → verify → login in staging; wrong-password
and token-reuse attempts blocked.

**Acceptance Scenarios**:

1. **Given** a new email, **When** the user registers, **Then** an account
   is created `unverified`, a verification email is sent, and the password
   is stored Argon2id-hashed.
2. **Given** a verified account, **When** the user logs in, **Then** an
   access token (15 min) and rotated refresh token (30 d, hashed) are
   issued; response carries no plaintext secrets.
3. **Given** 10 failed logins on one account in 15 min, **When** an 11th
   attempt occurs, **Then** it is rejected with a lockout message and an
   alert is emitted.

### User Story 2 — MFA for sellers and staff (Priority: P2)

Sellers and staff must enable TOTP MFA before acting; recovery codes are
issued once.

**Why this priority**: money actions demand stronger auth (ADR-0007).

**Independent Test**: enable MFA → login requires code → recovery code
works → device revocation kills all sessions of the family.

**Acceptance Scenarios**:

1. **Given** a seller without MFA, **When** they try to open the dashboard,
   **Then** they are redirected to MFA setup.
2. **Given** an MFA-enabled user, **When** logging in on a new device,
   **Then** a TOTP code is required and a new session family starts.
3. **Given** a stolen-device report, **When** the user revokes devices,
   **Then** all refresh tokens in that family are invalidated immediately.

### User Story 3 — Social login with account linking (Priority: P2)

Users can log in with Google/Facebook/Apple; an existing account with the
same verified email links.

**Why this priority**: conversion; expected by buyers.

**Independent Test**: OIDC flow in staging against test providers.

**Acceptance Scenarios**:

1. **Given** no account for the email, **When** Google login completes,
   **Then** an account is created verified and a session starts.
2. **Given** an existing email/password account, **When** the same email
   logs in via Google, **Then** accounts link and both methods work.

### User Story 4 — Seller onboarding to active shop (Priority: P1)

A seller completes profile + shop creation; shop starts `draft`, becomes
`active` after KYC draft + admin approval (auto-approve in staging/dev
permission config).

**Why this priority**: supply side; unblocks M2 catalog work.

**Independent Test**: full journey end-to-end; admin approve flow.

**Acceptance Scenarios**:

1. **Given** a verified user, **When** they start onboarding, **Then** a
   shop is created (`draft`) with slug/name validation and a default
   commission config.
2. **Given** KYC fields submitted, **When** admin approves (or policy
   auto-approves), **Then** shop becomes `active` and the seller sees the
   dashboard.
3. **Given** a suspended shop, **When** the owner logs in, **Then** a
   suspension notice is shown and selling endpoints are blocked.

### Edge Cases

- Email already registered → "account exists" with password reset link.
- Verification token expired/reused → regenerate; never leak validity.
- Refresh token replay → rotate family, force re-login.
- Onboarding abandoned mid-way → resumable, data persisted as draft.
- Suspicious login (new geo/device) → alert email, no block (false-positive
  tolerance) with MFA as the strong control.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Register with email+password (Argon2id) and email
  verification with expiring, single-use tokens.
- **FR-002**: Login/logout, access+refresh tokens (RS256, rotation,
  hashed refresh storage), session family management, device revocation.
- **FR-003**: Password reset with rate limiting and token single-use.
- **FR-004**: TOTP MFA enable/verify/disable (with current-password +
  OTP), recovery codes; enforced for seller/staff roles.
- **FR-005**: Social login (Google, Facebook, Apple) with verified-email
  linking.
- **FR-006**: RBAC: roles (`buyer/seller/staff/admin`), permission keys,
  shop-scoped seller roles; endpoint guards; deny-by-default.
- **FR-007**: Seller onboarding: profile, shop creation (`draft`),
  KYC draft, admin approval → `active`; suspension/reinstatement flows.
- **FR-008**: Audit events for all auth and admin actions (identity audit
  schema).
- **FR-009**: Rate limiting (login, register, reset, MFA) with lockout and
  alerts; login anomaly detection hooks.
- **FR-010**: Notification templates: verification, welcome, login alert,
  suspension, MFA setup.

### Key Entities

- `users`, `sessions` (+ family), `roles`, `role_assignments`,
  `permissions`, `audit_events` (identity schema, data-model.md).
- `shops`, `seller_kyc` (marketplace schema; onboarding touches both —
  identity owns the user, marketplace owns the shop).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Signup → verified → first login in < 2 minutes.
- **SC-002**: Seller onboarding → active shop in < 10 minutes user time.
- **SC-003**: Login API p95 < 200 ms; auth-related 5xx rate < 0.1%.
- **SC-004**: Zero auth bypass findings in the ASVS L2 auth checklist
  (M6 pentest prep).

## Assumptions

- Email delivery via Resend (SendGrid-compatible abstraction); provider
  swap allowed behind the notification module.
- Social providers: Google, Facebook, Apple (EU-relevant).
- Staff/admin identities are seeded by a bootstrap script from Secrets
  Manager, not open registration.
