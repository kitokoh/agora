# Agora — Documentation

**Index** — start here, then follow the map.

| Doc | Read when |
| --- | --- |
| [architecture.md](architecture.md) | onboarding, any cross-cutting change (C4, modules, money flow) |
| [data-model.md](data-model.md) | touching schema, adding entities, migrations |
| [security.md](security.md) | auth, payments, PII, secrets, threat model |
| [observability.md](observability.md) | adding logs/traces/metrics, SLOs, dashboards |
| [operations.md](operations.md) | environments, CI/CD, migrations, runbooks, DR |
| [roadmap.md](roadmap.md) | milestone planning, phasing, exit criteria |
| [agent-operations.md](agent-operations.md) | **agents**: how to work on this repo |
| [decisions/](decisions/) | ADRs — every ratified architecture decision |

## Documentation rules

- Architecture-affecting changes update the relevant ADR in the same PR.
- Specs live in `specs/` (Spec Kit artifacts), not in `docs/`.
- Diagrams are Mermaid, kept in sync with code by the author of the change.
