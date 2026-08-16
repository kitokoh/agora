# ASVS L2 — Authentication Checklist (Agora M1)

> Status: **in review** — every item below is exercised by the identity
> integration suite (`services/api/test/identity.integration.test.ts`,
> RUN_DB_TESTS=1). Remaining gaps are tracked as issues, not silently
> deferred. Owner: `agent:security` (issue #33).

## V2 Authentication

| ASVS 2.x | Control | Agora status | Evidence |
| --- | --- | --- | --- |
| 2.1.1 | No default credentials | ✅ | Argon2id-hashed passwords only; no seeded user accounts |
| 2.1.2 | Set/change password requires current password | ✅ | MFA enable/disable + recovery regen verify password first |
| 2.1.3 | Password reset requires identity proof (token) | ✅ | 1-hour single-use reset token (#25) |
| 2.1.4 | Credential change invalidates sessions | ✅ | Reset revokes ALL sessions (#25) |
| 2.1.5 | Password policy (min length) | ✅ | 8–128 + letter + digit; 422 PASSWORD_POLICY |
| 2.1.6 | Anti-brute-force (rate limit + lockout) | ✅ | Redis buckets; 10 fails/15 min → 423 ACCOUNT_LOCKED (#24) |
| 2.1.7 | Multi-factor auth for privileged roles | ✅ | TOTP enforced for seller/staff/admin (428 MFA_SETUP_REQUIRED) (#26) |
| 2.1.8 | MFA recovery with fallback | ✅ | 10 single-use hashed recovery codes (#26) |
| 2.2.1 | Passwords stored with strong salted hash | ✅ | Argon2id (19 MiB, t=2) (#21) |
| 2.2.2 | No plaintext storage | ✅ | sha256-hashed refresh tokens + one-time tokens |
| 2.3.1 | Session id random & high entropy | ✅ | 48-byte base64url refresh tokens |
| 2.3.2 | Session expiry | ✅ | 30 d refresh TTL; 15 min access TTL |
| 2.3.3 | Session invalidation on logout | ✅ | Logout revokes the session row (#23) |
| 2.4.1 | Inactive session timeout | ⚠️ gap | Server-side idle timeout not implemented → issue #AUDIT-1 |
| 2.5.1 | Out-of-band verification link expiry | ✅ | 24 h verification / 1 h reset tokens |
| 2.5.2 | Verification links single-use | ✅ | Atomic consume + reuse rejection (#22) |
| 2.6.1 | Lookup secrets (recovery codes) protected | ✅ | Hashed at rest, timing-safe compare |
| 2.6.2 | No account enumeration | ✅ | Register 409 + reset/resend always-200 (#21/#22/#25) |
| 2.7.1 | Audit auth events | ✅ | identity.audit_events: register/verify/login/refresh/logout/MFA/anomaly (#20/#23/#26) |
| 2.8.1 | Defense-in-depth for high-risk flows | ⚠️ gap | IP reputation + device fingerprinting → M5 hardening |

## V3 Session Management

| ASVS 3.x | Control | Status | Evidence |
| --- | --- | --- | --- |
| 3.1.1 | Never expose tokens in URLs/logs | ✅ | Bearer header; pino logs exclude tokens |
| 3.2.1 | Session cookie flags (HttpOnly/Secure/SameSite) | ✅ frontend | Cookie option in #23; enforced in web middleware (M1 UI) |
| 3.3.1 | Logout invalidates session server-side | ✅ | Row revoked on logout |
| 3.4.1 | Session rotation | ✅ | Refresh rotation + family reuse revocation (#23) |
| 3.5.1 | Revoke sessions on password change | ✅ | Reset + MFA disable revoke |

## V4 Access Control (RBAC)

| ASVS 4.x | Control | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.1 | Deny by default | ✅ | requirePerm guards; no implicit allow (#28) |
| 4.2.1 | Role → permission matrix | ✅ | Seeded matrix + cached PermissionService (#28) |
| 4.3.1 | Sensitive actions re-auth (step-up) | ⚠️ gap | Payouts/disputes step-up → M3/M5 |

## Open items

- **#AUDIT-1** — server-side session idle timeout + absolute lifetime
- **#AUDIT-2** — PII masking in audit/log payloads (email redaction)
- **#AUDIT-3** — refresh-token rotation already shipped; add device
  fingerprint binding to session families (M5)

Sign-off: `agent:security` review of `authn|authz|mfa|sessions` files
completed in PRs #45–#48. ASVS L2 checklist re-run at M6 pentest prep.
