# Security Policy

## Reporting

If you find a security vulnerability in Agora, **do not open a public
issue**. Report privately:

- For the platform: open an issue with the `security` label and mark it
  confidential (or contact the maintainers directly).
- Include: affected endpoint/module, repro steps, impact, suggested fix if
  known. Request-ids/log excerpts help.

## Response

| Severity | First response | Fix target |
| --- | --- | --- |
| Critical (RCE, auth bypass, money theft, PII leak) | 24 h | 48 h emergency release |
| High | 48 h | 7 days |
| Medium/Low | 7 days | next milestone |

## Scope

In scope: `services/*`, `apps/*`, `packages/*`, `infra/*`, CI/CD config.
Out of scope: third-party dependencies (report upstream), Stripe/cloud
infrastructure themselves.

## Safe harbor

Good-faith, non-destructive testing is welcome. Don't test against
production; use staging or local. Public disclosure only after a fix ships.

## Our commitments

- Secrets never in code; secret leaks are incidents.
- Money moves only through the ledger (ADR-0006).
- PCI scope = SAQ-A via Stripe; card data never touches our servers.
- Security baseline: docs/security.md; ASVS L2 checklist before launch (M6).
